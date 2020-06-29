# Web Platform Incubator Community Group

This repository is being used for work in the Web Platform Incubator Community Group, governed by the [W3C Community License 
Agreement (CLA)](http://www.w3.org/community/about/agreements/cla/). To contribute, you must join 
the CG. 

If you are not the sole contributor to a contribution (pull request), please identify all 
contributors in the pull request's body or in subsequent comments.

To add a contributor (other than yourself, that's automatic), mark them one per line as follows:

```
+@github_username
```

If you added a contributor by mistake, you can remove them in a comment with:

```
-@github_username
```

If you are making a pull request on behalf of someone else but you had no part in designing the 
feature, you can remove yourself with the above syntax.
# Contributing 

Everyone is welcome to contribute to this specification.

Any simple editorial contribution can simply be done with a GitHub Pull Request.
You can even do an inline edit of the file on GitHub.

## Style guide to contributors 

- the spec uses [ReSpec](https://www.w3.org/respec/) 
- the spec is tidied using [HTML5 Tidy](https://github.com/htacg/tidy-html5). For
instructions on running HTML5 tidy, see below.  
- put comments in front of sections, for better readability with
  syntax coloring editors


## Running HTML5 Tidy

Please make sure you have HTML5 tidy installed, instead of
the one that  ships with *nix systems. You can comfirm this by running:

```bash 
tidy5 --version  #HTML Tidy for Mac OS X version 4.9.XX ...
```
Once you have confirmed (make sure you have committed your changes before
running tidy, as the changes are destructive ... in a good way:)):

```bash 
tidy5 -config tidyconfig.txt -o index.html index.html
```
