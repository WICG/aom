# Element Handles for cross-root ARIA

Authors: [Ben Howell](https://github.com/behowell)

## Introduction

### The Problem

For more background on the cross-root ARIA problem and other proposals, see Alice Boxhall's article [How Shadow DOM and accessibility are in conflict](https://alice.pages.igalia.com/blog/how-shadow-dom-and-accessibility-are-in-conflict/). As laid out in Alice's article, there are separate but related problems to solve:

* **[Referring into Shadow DOM](https://alice.pages.igalia.com/blog/how-shadow-dom-and-accessibility-are-in-conflict/#referring-into-shadow-dom)**. An element in the light tree needs to create a relationship like `aria-activedescendant` to an element inside a shadow tree.
* **[Referring from Shadow DOM outwards](https://alice.pages.igalia.com/blog/how-shadow-dom-and-accessibility-are-in-conflict/#referring-from-shadow-dom-outwards)**. An element inside a shadow tree needs to create a relationship like `aria-labelledby` with an element in the light tree.
* **Referring out from one Shadow DOM and into another**. There is also the combined case, where an element in one shadow tree needs to refer to an element in a sibling shadow tree (or any relationship that is not a direct ancestor/descendant relationship). A complete solution should work in this case as well. An example is described by Nolan Lawson: [ARIA element reflection across non-descendant/ancestor shadow roots](https://github.com/WICG/aom/issues/192).

### Existing proposed solutions

There have been a number of solutions proposed to one or both of the problems listed above. In general, they fall into one of two categories: either changing how attribute lookups work, or changing how ID reference lookup works:

#### Attribute lookup changes

Attributes on the host element like `aria-labelledby` are delegated to an element inside the shadow tree. The delegate element is chosen by the author of the web component (not the user).

Proposals in this category include:
- [Cross-root ARIA delegation](https://github.com/leobalter/cross-root-aria-delegation/blob/main/explainer.md)
- [Cross-root ARIA reflection](https://github.com/Westbrook/cross-root-aria-reflection/blob/main/cross-root-aria-reflection.md)
- [Semantic Delegate](https://github.com/alice/aom/blob/gh-pages/semantic-delegate.md)

**Pros**
- Simple for the user: attributes on the custom component "just work" without needing additional knowledge of the component.
- Does not expose any component internals outside of the shadow tree.

**Cons**
- The Bottleneck Effect: only one element in the shadow DOM can be the target of an attribute. For example, there's no way for a range slider component, which has two input elements (min and max), to have separate labels for each input.
- The component is in charge of picking the target of an attribute. For example, in the case of `aria-activedescendant`, it's up to the component to internally track the active descendant, and re-delegate the attribute to the correct element.
- Potentially confusing which attributes are delegated; and it's not necessarily consistent between web components.

#### ID lookup changes

Provide a way for users to directly target elements in the shadow tree.

Proposals in this category include:
  - [Content attribute to import/export IDs across shadow boundaries](https://github.com/WICG/aom/issues/169)
  - [Using ::part](https://alice.pages.igalia.com/blog/how-shadow-dom-and-accessibility-are-in-conflict/#part)
  - [Encapsulation-preserving IDL Element reference attributes](https://github.com/WICG/aom/issues/195)
  - This proposal: Element Handles

**Pros**
- No bottleneck effect: the developer using the component can target any element that the component author exposed via handles.
- Re-targeting an attribute like `aria-activedescendant` can be handled by either the developer using the component (by changing the value of `aria-activedescendant`) OR by the component author (by internally moving names to different elements).

**Cons**
- Increased complexity when using a component: need to know some details about the internals of the component to target the correct element (can be published with documentation for the web component).

## Proposal

Create a new attribute named `handle`. This attribute would be a way to refer to an element similar to `id`, but can only be used as the target of certain attributes that refer to other elements, such as `aria-labelledby` or `for`.

It's similar in concept to the `part` attribute. However, it is _only_ used for creating links between elements, and not styling. Addtionally, only a single element in a tree can have a given `handle` (unlike `part`, which can be applied to multiple elements).

### Referring to handles

Handle names can be used directly in ID reference attributes using the `id::handle()` syntax. The `id` specifies the ID of the host element that the handle belongs to, and the handle name is in the parentheses (see the example below).

**Example 1: Referring into the shadow tree**

```html
<label for="x-input::handle(the-input)">Example Label</label>
<x-input id="x-input">
  #shadowRoot
  | <input handle="the-input" type="text" />
</x-input>
```

### Exporting handle names

Handle names can also be exported using `exporthandles` to put them in the "namespace" of the parent component. This is similar in concept to [exportparts](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/exportparts), but for handles instead of parts.

Multiple handles can be exported, separated by a comma. Handles can also optionally be renamed: `exporthandles="name1, inner-name2: outer-name2"`.

> **Open question**: The exportparts attribute supports wildcards `*`; should exporthandles have wildcard support as well?

**Example 2: Referring through multiple layers of shadow trees**

Using `exporthandles` is required in this example, because handle chaining is not allowed. It would not work to write: `for="x-combobox::handle(x-input)::handle(the-input)"`.

```html
<label for="x-combobox::handle(the-input)">Example Label</label>
<x-combobox id="x-combobox">
  #shadowRoot
  | <x-input handle="x-input" exporthandles="the-input">
  |   #shadowRoot
  |   | <input handle="the-input" type="text" />
  | </x-input>
</x-combobox>
```

### Importing handles

When an element inside the shadow tree needs to refer OUT, it can use an imported handle.

The `importhandles` attribute specifies a mapping from `inner-handle: outer-id`. The `inner-handle` names are determined by the web component author, and the `outer-id` names are provided by the user of the web component.

Inside the shadow tree, imported handles are referenced using the `:host::handle()` syntax, using the 'special' ID `:host` to refer to handles specified on the host element. This looks for handle names in the current scope, including ones imported using `importhandles`.

> **Open question**: is it confusing that `importhandles` maps "handle-name: id-name", unlike `exporthandles`, which maps "handle-name: handle-name"? It may be worthwhile considering another name for this attribute, like `handle-id-map`, or some other better name.

**Example 3: Importing handles**

```html
<label id="the-label">Example Label</label>
<x-input id="x-input" importhandles="labelledby: the-label">
  #shadowRoot
  | <input aria-labelledby=":host::handle(labelledby)" type="text" />
</x-input>
```

### Referring across sibling shadow trees

The `importhandles` attribute can also refer to a handle inside another shadow tree. This allows references that don't strictly follow a descendant-ancestor relationship.

**Example 4: Referring across multiple shadow trees**

In this example, both the `label` and `input` are inside separate shadow trees, but can still 

```html
<x-label id="x-label" importhandles="label-for: x-input::handle(the-input)">
  #shadowRoot
  | <label for=":host::handle(label-for)">Example Label</label>
</x-label>
<x-input id="x-input">
  #shadowRoot
  | <input handle="the-input" type="text" />
</x-input>
```

### JavaScript API

> 🚧 NOTE: This area of the proposal still needs more work.

It may be useful to be able to get and set elements by ID reference in JavaScript. It may be possible to adopt the ideas from [Encapsulation-preserving IDL Element reference attributes (WICG/aom#195)](https://github.com/WICG/aom/issues/195) here.

A new API `getElementHandle()` can look up elements by handle name, and return an opaque type `ElementHandle`. This opaque type would not allow any access to attributes or other properties of the element. However, it can be passed to the IDL attributes that take element references. E.g.:

```javascript
const labelHandle = document.getElementById('x-label').getElementHandle('the-label');
input.ariaLabelledByElements = [labelHandle];
```

Missing in this proposal: how to reconcile the fact that `ariaLabelledByElements` is currently an array of `Element`, and _not_ `ElementHandle`. What does the getter for `ariaLabelledByElements` return if it contains an `ElementHandle`? 

### Attributes supporting `::handle()`

The following is an initial list of elements that will support lookups of handles using the `::handle()` syntax. It may be worthwhile exploring whether there is a need to limit this list at all, or whether it is acceptable to have refids work for _any_ attribute that refers to another element by ID:

* `aria-activedescendant`
* `aria-controls`
* `aria-describedby`
* `aria-details`
* `aria-errormessage`
* `aria-flowto`
* `aria-labelledby`
* `aria-owns`
* `for`
* `importhandles`
* (List is likely incomplete so far)

## Alternatives

### Potential alternative names for the attributes

* `publicid`
* `exportid`
* `partid` (re-emphasizes the similarity to `part`, but potentially confusing since it is distinct from `part`).
* _Other suggestions?_

### Reuse the `id` attribute

Rather than creating a new attribute `handle`, we could instead just export elements by `id`?

The component would need some way to opt into exporting IDs. In the case of `handle`, this is done simply by the existence of the `handle` attribute. Instead, there would be another attribute on the `<template>` element, like `shadowrootexportsids`, which lists the IDs that are part of the public API. This could also allow optional renaming of IDs: `shadowrootexportsids="id1, id2, internal-id3: exported-id3"`

For example:

```html
<label for="x-input::the-input">Example</label>

<x-input id="x-input">
  <template shadowrootmode="open" shadowrootexportsids="the-input">
    <input id="the-input" type="text" />
  </template>
</x-input>
```

**Pros**

* Doesn't introduce another "id-like" attribute (`handle`).
* Still allows explicit opt-in to exporting elements by ID.

**Cons**

* Need to resolve what happens when someone calls `getElementById('x-input::the-input')` for a closed shadow root.

### Reuse the `part` attribute

The [part proposal](https://alice.pages.igalia.com/blog/how-shadow-dom-and-accessibility-are-in-conflict/#part) would use the existing [`part` attribute](https://dev.to/webpadawan/css-shadow-parts-are-coming-mi5) rather than introduce a new attribute.

A corrolary to this proposal is to add new aria attributes that create relationships in the opposite direction (e.g. `aria-describes`) to mitigate the number cases where it is necessary to refer out.

* **Pros**
  * No new concepts needed; re-using existing `part` attribute.
  * Allows referring directly to elements inside the shadow tree, which avoids the "bottleneck effect". Parts within the shadow tree can be referred to separately by different aria attributes.

* **Cons**
  * No separation of concerns between ID references and CSS styling:
    * Does not allow a part to be exported _only_ for ID references (for accessibility) without _also_ allowing it to be re-styled. Component authors may not want to allow internal elements to be the targets of CSS styles.
    * Existing controls using `part` will now have those parts exposed as part of their public API for being the targets of `aria-labelledby`, etc. with no explicit opt-in.
  * Requires new reverse aria attributes like `aria-labels`/`aria-describes` to be feasable.
  * Even with reverse aria attributes, there is no way to link elements within sibling shadow trees, as in **Example 4: Referring across multiple shadow trees** above.
  * Since `part` was originally intended only for CSS styling, it is a less natural fit for this case. Its semantics are closer to `class` than `id`: multiple elements can share the same `part` name, and a single element can have multiple `part` names.