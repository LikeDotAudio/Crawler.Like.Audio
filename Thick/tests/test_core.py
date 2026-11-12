# Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
# MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
"""The Thick half's logic with no window: which paths a crawl skips
(.gitignore), where its state lives (never the checkout), and the crawl's
worker pool and content dedup (ROAD-3777).

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
from crawler import corpus_format as cf  # noqa: E402
from crawler.crawler_module import Crawler  # noqa: E402
from crawler.extractor_module import CommentAndMarkdownExtractor  # noqa: E402
from crawler.regenerator_module import ProjectRegenerator  # noqa: E402

CREATED = '2026-11-12 00:00:00'


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


    def test_crawl_workers_setting(self):
        with mock.patch.object(config_manager, 'LEGACY_CONFIG', os.path.join(self.tmp.name, 'none.ini')):
            c = ConfigManager(self.path)
            self.assertEqual(c.get_crawl_workers(), config_manager.DEFAULT_CRAWL_WORKERS)
            c.set_crawl_workers(3)
            self.assertEqual(ConfigManager(self.path).get_crawl_workers(), 3)
            c.config['General']['crawl_workers'] = 'many'
            self.assertEqual(c.get_crawl_workers(), config_manager.DEFAULT_CRAWL_WORKERS)
            c.config['General']['crawl_workers'] = '0'
            self.assertEqual(c.get_crawl_workers(), 1)


def plant(root):
    """A folder of many files with planted duplicates: three copies of one
    script (two in sub-folders), a renamed Markdown twin, a binary pair, two
    empty files (never linked) and 200 distinct files."""
    def put(rel, data):
        path = os.path.join(root, *rel.split('/'))
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb') as f:
            f.write(data.encode('utf-8') if isinstance(data, str) else data)
    script = '# the script\nclass A:\n    def go(self):\n        return 1\n'
    put('a_script.py', script)
    put('copies/b_script.py', script)
    put('copies/deep/c_script.py', script)
    put('docs/readme.md', '# Hello\n\nsame words\n')
    put('docs/zz_renamed.txt', '# Hello\n\nsame words\n')
    put('media/kick.wav', bytes(range(256)) * 64)
    put('media/kick copy.wav', bytes(range(256)) * 64)
    put('empty_one.txt', '')
    put('empty_two.txt', '')
    for i in range(200):
        put(f'many/d{i % 7}/file{i:03}.py', f'# file {i}\ndef f{i}():\n    return {i}\n')


class DedupAndPool(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = os.path.join(self.tmp.name, 'planted')
        plant(self.root)

    def tearDown(self):
        self.tmp.cleanup()

    def crawl(self, workers, logs=None):
        out = os.path.join(self.tmp.name, f'out{workers}-{len(os.listdir(self.tmp.name))}')
        os.makedirs(out)
        ex = CommentAndMarkdownExtractor(out)
        ex.open_file()
        log = (lambda m, t: logs.append((m, t))) if logs is not None else None
        crawler = Crawler(self.root, None, log_callback=log, extractor=ex, workers=workers)
        map_text, everything = crawler.crawl(created=CREATED)
        ex.close_file()
        with open(ex.output_file_path, encoding='utf-8') as f:
            return crawler, map_text, everything, f.read()

    def test_duplicates_are_linked_not_saved_twice(self):
        crawler, map_text, everything, extracted = self.crawl(4)
        self.assertEqual(crawler.duplicates, 4)
        links = {l['path']: l['sameAs'] for l in cf.parse_links(everything)}
        # the first copy in map order (folders before files) is the one kept
        self.assertEqual(links, {
            'a_script.py': 'copies/deep/c_script.py',
            'copies/b_script.py': 'copies/deep/c_script.py',
            'docs/zz_renamed.txt': 'docs/readme.md',
            'media/kick.wav': 'media/kick copy.wav',  # ' ' sorts before '.'
        })
        files = [f['path'] for f in cf.parse_everything(everything)['files']]
        self.assertIn('copies/deep/c_script.py', files)
        self.assertNotIn('a_script.py', files)
        self.assertNotIn('copies/b_script.py', files)
        self.assertNotIn('docs/zz_renamed.txt', files)
        self.assertIn('empty_one.txt', files)  # empty files are never linked
        self.assertIn('empty_two.txt', files)
        self.assertEqual(everything.count('class A:'), 1)
        self.assertEqual(extracted.count('# the script'), 1)
        self.assertEqual(extracted.count('same words'), 1)
        self.assertIn('b_script.py  (same as: copies/deep/c_script.py)', map_text)
        self.assertIn('file199.py  (classes: 0, functions: 1)', map_text)
        self.assertEqual(len(files), 1 + 1 + 2 + 200)

    def test_output_is_the_same_whatever_the_pool_size(self):
        logs1, logs8 = [], []
        one = self.crawl(1, logs1)[1:]
        for _ in range(3):
            self.assertEqual(self.crawl(8, logs8 if not logs8 else [])[1:], one)
        def no_count(logs):  # the first line names the pool size
            return [m for m in logs if 'threads' not in m[0]]
        self.assertEqual(no_count(logs8), no_count(logs1))

    def test_regenerate_writes_the_linked_copies_back(self):
        everything = self.crawl(4)[2]
        dest = os.path.join(self.tmp.name, 'regen')
        n = ProjectRegenerator().regenerate_text(everything, dest)
        self.assertEqual(n, 204 + 3)  # three text links; the binary pair is in the map only
        for rel in ['a_script.py', 'copies/b_script.py', 'docs/zz_renamed.txt']:
            with open(os.path.join(dest, *rel.split('/')), encoding='utf-8') as a, \
                    open(os.path.join(self.root, *rel.split('/')), encoding='utf-8') as b:
                self.assertEqual(a.read(), b.read())
        self.assertFalse(os.path.exists(os.path.join(dest, 'media')))

    def test_no_duplicates_no_link_lines(self):
        everything = Crawler(os.path.join(self.root, 'many'), None, workers=2).crawl(created=CREATED)[1]
        self.assertNotIn(cf.LINK_PREFIX, everything)
        self.assertEqual(cf.parse_links(everything), [])


if __name__ == '__main__':
    unittest.main()
