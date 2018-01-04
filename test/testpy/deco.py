class deco(object):
    def wrapper(self, f):
        print(self.prefix, f.__name__)
        f()

    def __init__(self, prefix):
        self.prefix = prefix

    def __call__(self, *args, **kwargs):
        return self.wrapper(*args, **kwargs)

@deco('log') # d = deco('log') => d(f) => wrapper
def f():
    print('f')