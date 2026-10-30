class FakePipeline:
    """Pipeline gia lap: ghi lai lenh va chay tuan tu tren client gia khi execute()."""

    def __init__(self, client):
        self.client = client
        self.calls = []

    def __getattr__(self, name):
        method = getattr(self.client, name)

        def queue(*args, **kwargs):
            self.calls.append((method, args, kwargs))
            return self

        return queue

    def execute(self):
        results = [method(*args, **kwargs) for method, args, kwargs in self.calls]
        self.calls = []
        return results
