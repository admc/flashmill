import os
import mozrunner

parent_path = os.path.abspath(os.path.dirname(__file__))

venk = os.path.join(parent_path, 'venk')
ff = os.path.join(parent_path, 'firebug-1.4.2-fx.xpi')
ext = os.path.join(parent_path, 'flashmill/extension')

class CLI(mozrunner.CLI):
    def get_profile(self, *args, **kwargs):
        profile = super(CLI, self).get_profile(*args, **kwargs)
        profile.install_plugin(venk)
        profile.install_plugin(ff)
        profile.install_plugin(ext)

        return profile

if __name__ == "__main__":
    CLI().run()