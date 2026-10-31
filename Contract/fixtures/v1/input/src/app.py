import os


def top(a, b=1):
    def inner():
        return a
    return inner()


class Engine:
    """An engine."""

    def start(self):
        return os.getcwd()

    @staticmethod
    async def run():
        return None


class Empty:
    pass
