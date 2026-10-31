# Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
# MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
"""Thick against the crawl corpus contract (Contract/corpus.v1.json and
Contract/fixtures/v1/). Thin/test/corpus-contract.test.mjs runs the same
fixtures, so a rule or format change in one half fails here or there until
the other half and the fixtures agree.

Run from Thick/:  python3 -m unittest discover -s tests
"""
import json
import os
import shutil
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..'))

from crawler import corpus_format as cf  # noqa: E402
from crawler.crawler_module import Crawler  # noqa: E402
from crawler.regenerator_module import ProjectRegenerator  # noqa: E402
from crawler.utils_module import GitIgnoreMatcher  # noqa: E402

CONTRACT = os.path.join(HERE, '..', '..', 'Contract')
FIX = os.path.join(CONTRACT, 'fixtures', 'v1')
CREATED = '2026-10-30 00:00:00'


def load(*parts):
    with open(os.path.join(FIX, *parts), encoding='utf-8') as f:
        return json.load(f) if parts[-1].endswith('.json') else f.read()


class Contract(unittest.TestCase):
    """The constants in corpus_format.py are the contract's."""

    @classmethod
    def setUpClass(cls):
        with open(os.path.join(CONTRACT, 'corpus.v1.json'), encoding='utf-8') as f:
            cls.c = json.load(f)

    def test_version_and_markers(self):
        self.assertEqual(cf.CORPUS_FORMAT, self.c['format'])
        self.assertEqual(cf.CORPUS_VERSION, self.c['version'])
        self.assertEqual(cf.CORPUS_HEADER, self.c['header'])
        self.assertEqual(cf.BANNER, self.c['banner'])
        self.assertEqual(cf.SECTION_RULE, self.c['sectionRule'])

    def test_rules(self):
        self.assertEqual(cf.SKIPPED_DIR_NAMES, self.c['skippedDirNames'])
        self.assertEqual([p.pattern for p in cf.SKIPPED_DIR_PATTERNS], self.c['skippedDirPatterns'])
        self.assertEqual(cf.TEXT_EXTENSIONS, self.c['textExtensions'])
        self.assertEqual(cf.CATEGORIES, self.c['categories'])
        self.assertEqual(cf.OTHER_CATEGORY, self.c['otherCategory'])
        self.assertEqual(cf.DEFAULT_SELECTED_CATEGORIES, self.c['defaultSelectedCategories'])
        self.assertEqual(cf.AST_LANGUAGES, self.c['astMetrics']['languages'])
        self.assertEqual(cf.AST_MAX_BYTES, self.c['astMetrics']['maxBytes'])

    def test_name_cases(self):
        cases = load('name-cases.json')
        for c in cases['ext']:
            self.assertEqual(cf.ext_of(c['name']), c['ext'], c)
        for c in cases['skippedDir']:
            self.assertEqual(cf.is_skipped_dir(c['name']), c['skipped'], c)
        for c in cases['category']:
            self.assertEqual(cf.category_of(c['ext']), c['category'], c)
        for c in cases['text']:
            self.assertEqual(cf.is_text_file(c['name']), c['text'], c)

    def test_ignore_cases(self):
        cases = load('ignore-cases.json')
        m = GitIgnoreMatcher(tempfile.gettempdir() + '/no-such-crawler-root')
        m.add(cases['gitignore'])
        for c in cases['cases']:
            self.assertEqual(m.ignores(c['path'], c['isDir']), c['ignored'], c)


class Golden(unittest.TestCase):
    def test_crawl_of_the_fixture_folder_is_the_golden_corpus(self):
        map_text, everything = Crawler(os.path.join(FIX, 'input'), None).crawl(created=CREATED)
        self.assertEqual(map_text, load('expected', 'MAP.txt'))
        self.assertEqual(everything, load('expected', 'EVERYTHING.LOG'))
        self.assertEqual(cf.read_corpus_version(everything), 1)

    def test_ast_metrics(self):
        for path, expected in load('expected', 'ast-metrics.json').items():
            self.assertEqual(cf.python_metrics(load('input', *path.split('/'))), expected)

    def test_parse_cases(self):
        for name, expected in load('parse-cases.json')['expect'].items():
            text = load(*name.split('/'))
            if 'refused' in expected:
                with self.assertRaises(cf.UnsupportedCorpusVersion) as ctx:
                    cf.parse_everything(text)
                self.assertEqual(ctx.exception.version, expected['refused'])
            else:
                self.assertEqual(cf.parse_everything(text), expected, name)

    def test_a_downloaded_log_with_a_bom_still_reads(self):
        self.assertEqual(cf.read_corpus_version('﻿' + load('expected', 'EVERYTHING.LOG')), 1)

    def test_regenerate_round_trip(self):
        out = tempfile.mkdtemp()
        try:
            n = ProjectRegenerator().regenerate_text(load('expected', 'EVERYTHING.LOG'), out)
            self.assertEqual(n, 6)
            with open(os.path.join(out, 'src', 'app.py'), encoding='utf-8') as f:
                self.assertEqual(f.read(), load('input', 'src', 'app.py'))
            with self.assertRaises(cf.UnsupportedCorpusVersion):
                ProjectRegenerator().regenerate_text(load('future-v2.LOG'), out)
            ProjectRegenerator().regenerate_text(load('legacy-v0-thin.LOG'), out)
            self.assertFalse(os.path.exists(os.path.join(out, '..', 'escape.txt')))
        finally:
            shutil.rmtree(out)


class WebCrawlerTab(unittest.TestCase):
    def test_no_second_scraper(self):
        """The Web Crawler tab drives CAPTURE.WebScraper (apk_webscraper); the
        requests/BeautifulSoup copy it carried is gone and must stay gone."""
        folder = os.path.join(HERE, '..', 'crawler', 'tabs', 'WebCrawler')
        self.assertEqual(sorted(f for f in os.listdir(folder) if f.endswith('.py')),
                         ['__init__.py', 'view.py', 'web_crawler_tab.py'])
        with open(os.path.join(folder, 'web_crawler_tab.py'), encoding='utf-8') as f:
            source = f.read()
        self.assertIn('apk_webscraper.crawl(', source)
        self.assertNotIn('import requests', source)
        self.assertNotIn('BeautifulSoup', source)


if __name__ == '__main__':
    unittest.main()
