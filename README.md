# codewithrockstar.com

This is the website code for the [codewithrockstar.com](https://codewithrockstar.com) website.

It also includes the original source files for various bits of Rockstar artwork used on stickers, T-shirts and other swag.

## How it works

The site is managed using Github Pages and Jekyll. It doesn't use any custom theme - it's HTML, Markdown, and SASS.

The file `docs/satriani/js/satriani.js` is generated using browserify from the main Rockstar repository. 

One thing which is unusual is that the [main Rockstar repository](https://github.com/dylanbeattie/rockstar) is included in this repo as a submodule (in `docs/rockstar/`), which means we can use Jekyll's `{% include_relative path/to/file.md %}` directives to include snippets of Markdown for things like code samples and the language specification. This maintains separation between the code repo and the website repo without making me maintain two copies of everything, which is kinda neat.

