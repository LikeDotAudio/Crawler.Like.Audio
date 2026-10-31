# Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
# MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
"""The Thick half's two pieces of logic with no window: which paths a crawl
skips (.gitignore) and where its state lives (never the checkout).

Run from Thick/:  python3 -m unittest discover -s tests
"""
import os
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from crawler.utils_module import GitIgnoreMatcher  # noqa: E402
from crawler import config_manager  # noqa: E402
from crawler.config_manager import ConfigManager  # noqa: E402


def matcher(root, lines):
    with open(os.path.join(root, '.gitignore'), 'w') as f:
        f.write('\n'.join(lines) + '\n')
    return GitIgnoreMatcher(root)


class GitIgnore(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = self.tmp.name

    def tearDown(self):
        self.tmp.cleanup()

    def p(self, rel):
        return os.path.join(self.root, rel)

    def test_no_gitignore_skips_nothing(self):
        self.assertFalse(GitIgnoreMatcher(self.root).is_ignored(self.p('a/b.py')))

    def test_directory_pattern_skips_the_dir_and_everything_under_it(self):
        m = matcher(self.root, ['node_modules/'])
        self.assertTrue(m.is_ignored(self.p('node_modules'), is_dir=True))
        self.assertFalse(m.is_ignored(self.p('node_modules'), is_dir=False))
        self.assertTrue(m.is_ignored(self.p('web/node_modules/react/index.js')))
        self.assertFalse(m.is_ignored(self.p('src/modules.py')))

    def test_glob_matches_in_any_folder(self):
        m = matcher(self.root, ['*.log', '# a comment', ''])
        self.assertTrue(m.is_ignored(self.p('deep/run.log')))
        self.assertFalse(m.is_ignored(self.p('deep/run.py')))

    def test_anchored_pattern_holds_only_at_the_root(self):
        m = matcher(self.root, ['/build'])
        self.assertTrue(m.is_ignored(self.p('build')))
        self.assertTrue(m.is_ignored(self.p('build/x.o')))
        self.assertFalse(m.is_ignored(self.p('src/build/x.o')))

    def test_root_itself_is_never_ignored(self):
        self.assertFalse(matcher(self.root, ['*']).is_ignored(self.root))


class Config(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = os.path.join(self.tmp.name, 'sub', 'config.ini')

    def tearDown(self):
        self.tmp.cleanup()

    def test_state_lives_outside_the_checkout(self):
        with mock.patch.dict(os.environ, {'CRAWLER_CONFIG': '', 'XDG_CONFIG_HOME': self.tmp.name}):
            path = config_manager.default_config_path()
        self.assertEqual(path, os.path.join(self.tmp.name, 'crawler-like-audio', 'config.ini'))
        repo = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
        self.assertFalse(os.path.abspath(path).startswith(repo + os.sep))

    def test_override_wins(self):
        with mock.patch.dict(os.environ, {'CRAWLER_CONFIG': self.path}):
            self.assertEqual(config_manager.default_config_path(), self.path)

    def test_recent_folders_are_newest_first_without_repeats_and_survive_a_reload(self):
        with mock.patch.object(config_manager, 'LEGACY_CONFIG', os.path.join(self.tmp.name, 'none.ini')):
            c = ConfigManager(self.path)
            for f in ['/a', '/b', '/a']:
                c.set_last_folder(f)
            self.assertEqual(c.get_recent_folders(), ['/a', '/b'])
            self.assertEqual(ConfigManager(self.path).get_recent_folders(), ['/a', '/b'])


if __name__ == '__main__':
    unittest.main()
