<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Accessibility Tree](#accessibility-tree)
  - [Problem statements](#problem-statements)
    - [Consistency between user agents](#consistency-between-user-agents)
    - [Effect of new web features on accessibility APIs](#effect-of-new-web-features-on-accessibility-apis)
    - [Web Platform Testing](#web-platform-testing)
    - [Web page testing](#web-page-testing)
    - [Developer documentation, debugging and education](#developer-documentation-debugging-and-education)
  - [Potential audience for an Accessibility Tree spec](#potential-audience-for-an-accessibility-tree-spec)
    - [User agent implementers](#user-agent-implementers)
    - [Authors of other specs](#authors-of-other-specs)
    - [Developers](#developers)
  - [Lifecycle](#lifecycle)
  - [Related documents/prior work](#related-documentsprior-work)
  - [What needs to be specified?](#what-needs-to-be-specified)
    - [Platform-independent semantic properties](#platform-independent-semantic-properties)
    - [Tree inclusion/exclusion principles](#tree-inclusionexclusion-principles)
    - [Mapping between generic tree and platform APIs](#mapping-between-generic-tree-and-platform-apis)
  - [Open questions/assumptions](#open-questionsassumptions)
  - [Acknowledgements](#acknowledgements)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# Accessibility Tree

## Problem statements

### Consistency between user agents

The [Core-AAM](https://w3c.github.io/core-aam/)
and [HTML-AAM](https://w3c.github.io/html-aam/)
and, potentially in future, [CSS-AAM](https://w3c.github.io/css-aam/)
each describe some parts of the process of mapping from
a source language to platform accessibility APIs,
typically in the form of a mapping table.

However, while [Core-AAM](https://w3c.github.io/core-aam/)
has some language around conditions under which elements must be mapped
into the accessibility tree,
it is unable to provide a complete set of conditions under which elements
are _not_ mapped into the accessibility tree,
leading to inconsistencies between browsers,
which assistive technology vendors are forced to work around.

### Effect of new web features on accessibility APIs

We lack a process for web APIs to describe
their intended effect on accessibility APIs.

For example,
[`display: contents`](https://drafts.csswg.org/css-display/#valdef-display-contents)
in CSS
causes an element "not \[to\] generate any boxes".
This was intended not to affect "semantics"
([ref](https://www.w3.org/TR/css-display-3/#ref-for-propdef-display%E2%91%A0%E2%91%A2)),
but because in practice browsers tend to base the accessibility tree
on the CSS box tree,
this created a bug in most browsers where nodes with this property
were not exposed to the accessibility tree.

Since there exists no standard for how the accesibility tree is built,
there was no understanding of this potential impact,
and the issue was only discovered after the feature shipped and bugs were filed on various browsers.

Ideally, spec authors would be able to have some understanding
of how their feature _may_ impact accessibility tree generation,
and, where necessary,
be able to explicitly describe how it _should_ impact accessibility tree generation.

### Web Platform Testing

Once web spec authors are able to specify how their features
should impact the accessibility tree,
web platform tests will be needed in order to verify implementations.

A JavaScript-based API independent of
[platform API differences](https://w3c.github.io/core-aam/#comparing-accessibility-apis)
would streamline the testing process.

### Web page testing

Web page authors and authors of accessibility validation tools alike
are interested in methods for making assertions about how a web page
is expressed to assistive technology APIs.

To date, this has only been possible using various proprietary
and open source inspection tools,
by testing directly with assistive technology
(which naturally will always be a required step in accessibility testing)
or by writing tools which read information from
[platform APIs](https://w3c.github.io/core-aam/#comparing-accessibility-apis).

### Developer documentation, debugging and education

Various browsers provide tools to inspect the accessibility information
exposed for a particular DOM node,
potentially with a view of the browser's notion of the generic accessibility tree:

- [Firefox's Developer Tools](https://developer.mozilla.org/en-US/docs/Tools/Accessibility_inspector#Accessing_the_accessibility_inspector)
- [Safari's Web Inspector](https://webkit.org/blog/3302/aria-and-accessibility-inspector/)
- [Edge's DevTools](https://docs.microsoft.com/en-us/microsoft-edge/devtools-guide/elements/accessibility)
- [Chrome's DevTools](https://developers.google.com/web/tools/chrome-devtools/accessibility/reference#pane)

However, developers are unable to link this information to any definitive explanation
of what is being represented.

## Potential audience for an Accessibility Tree spec

### User agent implementers

The spec should document consensus reached between user agent implementers
and assistive technology implementers,
to allow user agent implementers to implement a consistent accessibility tree.

### Authors of other specs

Authors of web platform features should consider the intended impact
on the accessibility tree of their feature.

Authors of documents like HTML-AAM, Core-AAM etc may wish
to refer to a generic specification for the accessibility tree.

Any specification which aims to provide programmatic access
to the accessibility tree
will need a definition of the accessibility tree to refer to.

### Developers

Web Platform Test authors, web page authors and testing tool authors
may all find an accessibility tree specification informative.

## Lifecycle

Since the web platform is a moving target,
adopting a living or evergreen standard model will probably make the most sense.

## Related documents/prior work

- [Core-AAM](https://w3c.github.io/core-aam/)
- [HTML-AAM](https://w3c.github.io/html-aam/)
- [AccName](https://w3c.github.io/accname/)
- [ATTA-API](https://spec-ops.github.io/atta-api/index.html)
- [ARIA](https://w3c.github.io/aria/#accessibility_tree) has a discussion of the accessibility tree

## What needs to be specified?

### Platform-independent semantic properties

### Tree inclusion/exclusion principles

See https://w3c.github.io/aria/#tree_inclusion

### Mapping between generic tree and platform APIs

## Open questions/assumptions

- What needs to be normative and what doesn't?
- How close to a 1:1 mapping between "generic" tree and platform APIs is acceptable?
- Exactly which web platform tree should the accessibility tree be based on? - Suggestion:[flattened DOM tree](https://drafts.csswg.org/css-scoping-1/#flat-tree) (post Shadow DOM distribution) plus CSS generated content
  - Any other things to consider?
- `aria-hidden` removes things from the accessibility tree - [unless it is focusable](https://w3c.github.io/aria/#tree_inclusion)
- `display:none` and `visibility:hidden`
  - Firefox keeps them in the tree but marks them invisible, WebKit removes them. If we required that these stay in the accessibility tree, Blink and WebKit could modify their code to let you walk these nodes for AOM phase 4, but still remove them from the platform accessibility tree on some or all platforms.
- Accessibility tree order should match focus order.
- How should flexbox ordering affect accessibility tree ordering?
- Tables - the accessibility tree is in `thead`/`tbody`/`tfoot` order even if that doesn't match the DOM order
- Image maps - the accessibility tree contains a duplicate of the image map subtree each time it occurs
- `<select>` - the DOM tree has just `<select>` with a child of `<option>`, but on every platform the AX tree ends up with a node in-between, the `"menu"` role.
- What's the root of the tree? The document? The body? What if both the document and body have ARIA attributes? What if there are multiple bodies?

## Acknowledgements

Thanks to the following individuals for comments/input so far:

- Dominic Mazzoni, Google
- Ian Pouncey, The Paciello Group
- Joanmarie Diggs, Igalia
- Léonie Watson, The Paciello Group
- Melanie Richards, Microsoft
- Rossen Atanassov, Microsoft
- Ryosuke Niwa, Apple
