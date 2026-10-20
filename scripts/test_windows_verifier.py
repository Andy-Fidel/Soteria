"""Check installed resource identity without running an installer."""
import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("verifier", Path(__file__).with_name("verify-installed-windows.py"))
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


class ResourceIdentityTests(unittest.TestCase):
    def test_same_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            self.assertTrue(verifier.same_directory(directory, Path(directory)))

    def test_other_directory_is_rejected(self):
        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            self.assertFalse(verifier.same_directory(first, second))

    @unittest.skipUnless(sys.platform == "win32", "Windows extended path syntax")
    def test_extended_windows_path_is_same_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            self.assertTrue(verifier.same_directory("\\\\?\\" + str(Path(directory).resolve()), directory))


if __name__ == "__main__":
    unittest.main()
