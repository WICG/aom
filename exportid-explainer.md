# Exporting IDs from shadow roots for cross-root ARIA

Author: [Ben Howell](https://github.com/behowell)

Special thanks to [Alice Boxhall](https://github.com/alice) for significant feedback.

## Introduction

The Shadow DOM provides a powerful way to encapsulate web components and keep their implementation details separate from other code on the page. However, this presents a problem for accessibility, which needs to establish semantic relationships between elements on the page. There is currently no way to refer to an element inside another shadow tree from an attribute like `aria-labelledby`. Referring to elements across shadow root boundaries is called "cross-root ARIA", although it affects non-ARIA properties like the label's `for` attribute as well.

For more detailed background on the problem and other proposals to solve it, see Alice Boxhall's article [How Shadow DOM and accessibility are in conflict](https://alice.pages.igalia.com/blog/how-shadow-dom-and-accessibility-are-in-conflict/). 

As laid out in the article, there are separate but related problems to solve:

* [Referring into Shadow DOM](https://alice.pages.igalia.com/blog/how-shadow-dom-and-accessibility-are-in-conflict/#referring-into-shadow-dom): An element in the light tree needs to create a relationship like `aria-activedescendant` to an element inside a shadow tree.
* [Referring from Shadow DOM outwards](https://alice.pages.igalia.com/blog/how-shadow-dom-and-accessibility-are-in-conflict/#referring-from-shadow-dom-outwards): An element inside a shadow tree needs to create a relationship like `aria-labelledby` with an element in the light tree.
* There is also the combined case, where an element in one shadow tree needs to refer to an element in a sibling shadow tree (or any relationship that is not a direct ancestor/descendant relationship). A complete solution should work in this case as well. 
  * An example of when this is needed is described by Nolan Lawson: [ARIA element reflection across non-descendant/ancestor shadow roots](https://github.com/WICG/aom/issues/192).

The cross-root ARIA problem has been discussed for several years, and there have been many proposed solutions. Existing proposals are described below, in the **Alternative Solutions** sections. This proposal draws on the ideas from many of the other proposals.

## Proposal: Exported IDs

The `exportid` attribute is a way to allow an element inside a shadow tree to be referred to via an ID reference attribute like `aria-labelledby` or `for`, while preserving shadow DOM encapsulation.

**Goals**

* Create a mechanism for elements to refer to each other across shadow root boundaries through ID reference attributes like `aria-labelledby` or `for`.
* The solution should work the same for both closed and open shadow roots.
* Shadow DOM encapsulation should be preserved: Exporting an ID doesn't directly allow access to the underlying element. It is still required to have access to the shadow root to get the element.

**Non-Goals**

* Exported IDs are not available for CSS styling. That is the role of shadow parts.
* This proposal does not help with ARIA attributes that aren't ID references, such as `aria-label`.


## Referring to elements in a shadow tree

A new boolean attribute `exportid` specifies that an element is able to be referenced from outside of its shadow tree in attributes that support ID references. 

Elements outside of the shadow tree can refer to an exported ID with the syntax `"thehost::id(thechild)"`. In this example, `"thehost"` is the ID of the element that contains the shadow root, and `"thechild"` is the ID of an element inside the shadow tree that also has `exportid`. See the example below.

Exported ID references can be used in any attribute that refers to an element by ID, such as `for` or `aria-labelledby`.

#### Example 1: Referring into the shadow tree using handles

```html
<label for="x-input-1::id(input-2)">Example Label</label>
<x-input id="x-input-1">
  #shadowRoot
  | <input id="input-2" exportid />
</x-input>
```

### Requirements for `exportid` 

The element with `exportid` must also have an `id` that conforms to a more strict rules about what characters are allowed. Normally, [IDs are allowed to have any character except whitespace](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/id). For `exportid` to work, the `id` can only have letters, numbers, underscores, and hyphens (regex for permitted names: `[A-Za-z0-9_-]+`).

#### Example 1a: Invalid uses of `exportid`

```html
<x-input> <!-- Warning: The host must have an ID for elements inside to be referenced by exportid. -->
  #shadowRoot
  | <!-- Error: exportid requires an ID to be specified -->
  | <input exportid />
  |
  | <!-- Error: Although this is a valid ID, it can't be exported because it contains colons and parentheses. -->
  | <input id="::id(example)" exportid /> 
</x-input>
```

#### Example 1b: Exact ID name matches win

It is technically possible (though not recommended) that _another_ element could have an `id` that contains `::id(...)`, since colon and parentheses are valid characters in an ID. Referring to those elements by ID will continue to work as normal. The lookup algorithm will first check if there is an element with an exact ID match before trying to parse out the export ID syntax.

```html
<label for="x-input-1::id(input-2)">Example Label</label>

<!-- The label applies to THIS input because its ID is an exact match. -->
<input id="x-input-1::id(input-2)" />

<x-input id="x-input-1">
  #shadowRoot
  | <!-- This label does NOT apply to this input. -->
  | <input id="input-2" exportid />
</x-input>
```

### Forwarding exported IDs

Forwarding IDs is only necessary when there are multiple nested shadow trees, and will likely be relatively uncommon. It is not allowed to chain together multiple `::id()` values to refer into a nested shadow tree. For example, the following is not valid, and would not match anything: `for="x-combobox::id(x-input)::id(the-input)"`. This is to avoid exposing more structure than a component author may desire, and follows the same restrictions as the CSS `::part()` selector. 

Instead, exported IDs can be forwarded using `forwardids` to put them in the "namespace" of the parent component. This works similarly to [`exportparts`](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/exportparts).

Multiple IDs can be forwarded, separated by a comma. Forwarded IDs can also optionally be renamed: `forwardids="name1, inner-name2: outer-name2"`.

#### Example 2: Referring through multiple layers of shadow trees

```html
<label for="x-combobox-1::id(input-3)">Example Label</label>
<x-combobox id="x-combobox-1">
  #shadowRoot
  | <x-input id="x-input-2" forwardids="input-3">
  |   #shadowRoot
  |   | <input id="input-3" exportid />
  | </x-input>
</x-combobox>
```

## Referring out of the shadow tree with `useids`

The `::id()` syntax so far only allows referring into a shadow tree from the outside. However, it may also be necessary for an element inside a shadow tree to refer to an element outside. For example, using `aria-labelledby` or `aria-describedby` within a component to refer to external elements outside of the shadow tree.
  
The `useids` attribute specifies a mapping from `inner-id: outer-idref`. The `inner-id` names are determined by the web component author. The `outer-idref` names are provided by the user of the web component, and can be any element ID, including exported IDs using the `::id()` syntax.

Inside the shadow tree, imported IDs are referenced using the `:host::id()` syntax, using the special 'ID' `:host` to refer to IDs specified by `useid` on the host element. This syntax is analagous to the `:host::part()` CSS selector that can be used to select parts in the local tree.

Note: There is an open question below discussing an [alternative syntax for useids](#open-question-useids).

#### Example 3: Importing IDs with `useids`

This example shows how to import an ID called `"my-labelledby"` into a the x-input component, and reference it using the `":host::id()"` syntax.

```html
<span id="span-1">Example Label</span>
<x-input id="x-input-2" useids="my-labelledby: span-1">
  #shadowRoot
  | <input aria-labelledby=":host::id(my-labelledby)" />
</x-input>
```

#### Example 3a: Referring to multiple IDs via a single imported ID

Some attributes like `aria-labelledby` allow multiple IDs to be specified in their values: `aria-labelledby="label-1 label-2"`. If a useid definition contains multiple whitespace-separated IDREFs, then those IDs are all applied to the attribute.

In the following example, the computed label for the `<input>` is "One Two Three".

```html
<span id="span-1">One</span>
<span id="span-2">Two</span>
<x-input useids="my-labelledby: span-1 span-2">
  #shadowRoot
  | <span id="span-3">Three</span> 
  | <input aria-labelledby=":host::id(my-labelledby) span-3" />
</x-input>
```

### Referring across sibling shadow trees

The `useids` attribute can also refer to an element inside another shadow tree. This allows references that don't strictly follow a descendant-ancestor relationship.

#### Example 4: Label and Input in separate shadow trees

In this example, both the `label` and `input` are inside sibling shadow trees. The label uses `useids` and the `::id()` syntax to connect the two.

```html
<x-label id="x-label-1" useids="my-label-for: x-input-2::id(input-3)">
  #shadowRoot
  | <label for=":host::id(my-label-for)">Example Label</label>
</x-label>
<x-input id="x-input-2">
  #shadowRoot
  | <input id="input-3" exportid />
</x-input>
```

#### Example 5: A kitchen sink example of a Combobox

This is a more complex example utilizing several different features of exported/imported IDs. 
* The **x-combobox** component contains an **x-input** and an **x-listbox** component.
* The **x-input** has `forwardids="input-1"` so that the label's `for` attribute can refer to the input element.
* The **x-input** uses two imported ids: `my-activedescendant` and `my-listbox`. They are each mapped to an element inside the **x-listbox**'s shadow tree.

```html
<label for="x-combobox-1::id(input-2)">Example combobox</label>
<x-combobox id="x-combobox-1">
  #shadowRoot
  | <x-input 
  |   forwardids="input-2"
  |   useids="my-activedescendant: x-listbox-3::id(option-A), my-listbox: x-listbox-3::id(listbox-4)">
  |   #shadowRoot
  |   | <input
  |   |   role="combobox"
  |   |   id="input-2"
  |   |   exportid
  |   |   aria-controls=":host::id(my-listbox)"
  |   |   aria-activedescendant=":host::id(my-activedescendant)"
  |   |   aria-expanded="true"
  |   | />
  | </x-input>
  | <button aria-label="Open" aria-expanded="true">v</button>
  |
  | <x-listbox id="x-listbox-3">
  |   #shadowRoot
  |   | <div role="listbox" id="listbox-4" exportid>
  |   |   <div role="option" id="option-A" exportid>Option A</div>
  |   |   <div role="option" id="option-B" exportid>Option B</div>
  |   |   <div role="option" id="option-C" exportid>Option C</div>
  |   | </div>
  | </x-listbox>
</x-combobox>
```

## JavaScript API

Supporting exported and imported IDs in JavaScript requires several new APIs and updates to existing APIs.

### `Element.exportId` property

A boolean property that reflects the `exportid` attribute.

### `Element.forwardIds` property

A [`DOMStringMap`](https://developer.mozilla.org/en-US/docs/Web/API/DOMStringMap) that reflects the `forwardids` attribute.

#### Example 6: The `forwardIds` property

```html
<x-input id="x-input-1" forwardids="input-2, renamed-3: span-3">
  #shadowRoot
  | <div>
  |   <input id="input-2" exportid />
  |   <span id="span-3" exportid>...</span>
  | </div>
</x-input>
<script>
  const xInput = document.getElementById('x-input-1');
  console.log(xInput.forwardIds); // { 'input-2': 'input-2', 'renamed-3': 'span-3' }
</script>
```

### `Element.useIds` property

A [`DOMStringMap`](https://developer.mozilla.org/en-US/docs/Web/API/DOMStringMap) that reflects the `useids` attribute. Allows programmatic access to read and modify the list of imported IDs.

This is similar in function to the [`dataset` property](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dataset), except that convert kebab-case are _NOT_ converted to camelCase. All imported ID names are attributes as-is, and may need to be accessed using the `['']` syntax instead of the dot `.` syntax if they contain hyphens.

#### Example 7: The `useIds` property

```html
<x-input id="x-input-1" useids="my-listbox: listbox-1, my-activedescendant: listbox-1::id(option-A)" />
<script>
  const xInput = document.getElementById('x-input-1');
  console.log(xInput.useIds['my-listbox']); // 'listbox-1'
  console.log(xInput.useIds['my-activedescendant']); // 'listbox-1::id(option-A)'
  
  xInput.useIds['my-listbox'] = 'some-other-listbox';
  delete xInput.useIds['my-activedescendant'];

  // Changes are reflected back to the attribute
  console.log(xInput.getAttribute('useids')); // 'my-listbox: some-other-listbox'
</script>
```

### Properties that reflect IDREF attributes as strings

Exported ID references work as expected when setting or getting them on DOMString properties like [`HTMLLabelElement.htmlFor`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/htmlFor). The `::id()` syntax will continue to work as it does when setting the attributes in HTML markup.

```js
myLabel.htmlFor = 'x-input-1::id(input-2)';
console.log(myLabel.htmlFor); // 'x-input-1::id(input-2)'
```

### Properties that reflect IDREF attributes as Element objects

Some JavaScript attributes allow you to get the actual element object from an IDREF attribute, such as [`HTMLInputElement.labels`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/labels) or [`Element.ariaActiveDescendantElement`](https://w3c.github.io/aria/#dom-ariamixin-ariaactivedescendantelement) and other properties in ARIAMixin. To preserve encapsulation of the shadow DOM, these cannot return direct references to elements referred to by handles, since those elements may be inside shadow trees that are not accessible to the caller.

When accessing a property that refers to an element inside another shadow tree (using `::id()`), the returned element will be [retargeted](https://dom.spec.whatwg.org/#retarget) in the same way that's done for event targets in shadow DOM. In practice, this is typically the **host element** (i.e. the element specified before `::id()`), but it is more complex when using `useids`.

> **Note**: This solution borrows from Alice Boxhall's recommendation for [Encapsulation-preserving IDL Element reference attributes](https://github.com/WICG/aom/issues/195).

#### `getElementById`

We do not want `getElementById('host-1::id(child-2)')` to be a way to break encapsulation of the shadow DOM and access elements inside a shadow root. As such, it can't return the child element. The two basic options are:
1. **PROPOSED**: Return `null` as this is not an exact match for an ID.
   - **Pros**: The "safe" option, as it does not modify the current behavior of `getElementById`. It has parity with `querySelector` discussed below.
   - **Cons**: Makes `getElementById` useless with exported IDREFs. Also, it means the following two are not the same:
      ```js
      const byId = document.getElementById(el.getAttribute('aria-activedescendant')); // = null
      const byAttr = el.activeDescendantElement; // = the host element
      ```
2. Return the shadow host of the target element, using the [retargeting](https://dom.spec.whatwg.org/#retarget) algorithm.
   - **Pros**: Parity with IDREF attributes like `ariaActiveDescendantElement`.
   - **Cons**: It is potentially confusing that the ID of the returned element doesn't match the ID passed in.

The proposal is to use option 1 (return `null`); see [the example](#example-javascript-props) below. It may be possible to support option 2 later by adding an argument like `getElementById(id, { includeExportId: true })`. There is an open question below that discusses [other alternatives for getElementById](#open-question-getelementbyid) as well. However, any modification to `getElementById` would likely need to have a good motivating example.

#### `querySelector`/`querySelectorAll`

Exported IDs are NOT allowed to be used as CSS selectors, which means that `querySelector` and `querySelectorAll` will always return `null` when used with an exported IDREF.

<a id="example-javascript-props"></a>

#### Example 8: Accessing exported IDs by JavaScript properties

This is a simplified combobox example, to show the various methods of accessing the `aria-activedescendant` element.

```html
<input id="combobox-1" role="combobox" aria-activedescendant="x-listbox-2::id(option-A)" />

<x-listbox id="x-listbox-2">
  #shadowRoot
  | <div role="listbox">
  |   <div role="option" id="option-A" exportid>Option A</div>
  | </div>
</x-listbox>

<script>
  const combobox = document.getElementById('combobox-1');

  console.log(combobox.getAttribute('aria-activedescendant')); 
  // "x-listbox-2::id(option-A)"

  console.log(combobox.ariaActiveDescendantElement); 
  // <x-listbox id="x-listbox-2"> (Note this is the HOST element)

  console.log(document.getElementById("x-listbox-2::id(option-A)")); 
  // null

  console.log(document.querySelector("#x-listbox-2::id(option-A)")); 
  // null

  // If the shadow root is open (or the code has access to the shadowRoot in another way), 
  // then the actual element can be accessed like so.
  // Note: this is not a new proposed feature; it works prior to this proposal.
  console.log(document.getElementById('x-listbox-2').shadowRoot.getElementById('option-A')); 
  // <div id="option-A">
</script>
```

## Privacy and Security Considerations

No considerable privacy or security concerns are expected, but community feedback is welcome.

## Alternative Solutions

### Other proposals for cross-root ARIA

There have been a number of solutions proposed to allow referring to elements inside the shadow DOM. In general, they fall into one of two categories: either changing how attribute lookups work, or changing how ID reference lookup works.

#### Attribute lookup changes

In these solutions, attributes on the host element like `aria-labelledby` are delegated to an element inside the shadow tree. The delegate element is chosen by the author of the web component (not the user).

Proposals in this category include:
- [Cross-root ARIA delegation](https://github.com/leobalter/cross-root-aria-delegation/blob/main/explainer.md) by [Leo Balter](https://github.com/leobalter) and [Manuel Rego](https://github.com/mrego)
- [Cross-root ARIA reflection](https://github.com/Westbrook/cross-root-aria-reflection/blob/main/cross-root-aria-reflection.md) by [Westbrook Johnson](https://github.com/Westbrook/)
- [Semantic Delegate](https://github.com/alice/aom/blob/gh-pages/semantic-delegate.md) by [Alice Boxhall](https://github.com/alice)

**Pros**
- Simple for the user: attributes on the custom component "just work" without needing additional knowledge of the component.
- Does not expose any component internals outside of the shadow tree.

**Cons**
- The bottleneck effect: there can only be one value for a delegated attribute in the shadow DOM. For example, there's no way for a range slider component, which has two input elements (min and max), to have separate labels for each input: the same `aria-labelledby` would apply to each input.
- The component is in charge of picking the target of an attribute. For example, in the case of `aria-activedescendant`, it's up to the component to internally track the active descendant, and re-delegate the attribute to the correct element.
- Potentially confusing which attributes are delegated; and it's not necessarily consistent between web components.

#### ID lookup changes

Provide a way for users to directly target elements in the shadow tree.

Proposals in this category include:
  - [Content attribute to import/export IDs across shadow boundaries](https://github.com/WICG/aom/issues/169) by [Ryosuke Niwa](https://github.com/rniwa)
  - [Using ::part](https://alice.pages.igalia.com/blog/how-shadow-dom-and-accessibility-are-in-conflict/#part) by [Alice Boxhall](https://github.com/WICG/aom/issues/195) (?)
  - [The globalid attribute](https://gist.github.com/alice/54108d8037f865876702b07755f771a5#special-guids) by [Brian Kardell](https://github.com/bkardell)
  - [Encapsulation-preserving IDL Element reference attributes](https://github.com/WICG/aom/issues/195) by [Alice Boxhall](https://github.com/WICG/aom/issues/195) and [Nolan Lawson](https://github.com/nolanlawson)
  - [Element Handles](https://github.com/WICG/aom/pull/200) by [Ben Howell](https://github.com/behowell)
  - This proposal: Exported IDs

**Pros**
- No bottleneck effect: different elements in the same shadow DOM can have different values for the same attribute (e.g. two inputs in the shadow DOM can have two different `aria-labelledby` values).
- Re-targeting an attribute like `aria-activedescendant` can be handled by either the developer using the component (by changing the value of `aria-activedescendant`) OR by the component author (by internally moving names to different elements).

**Cons**
- Increased complexity when using a component: need to know some details about the internals of the component to target the correct element (can be published with documentation for the web component).

## Open Questions

### Is the syntax too verbose?

The specifics of the syntax will likely be a long-tail discussion of this proposal. Some early feedback for this proposal has centered around the verbosity of the syntax:

* The `::id()` part of the IDREF is not strictly necessary.
   * For example: `host-1::id(child-2)` could instead be shortened to `host-1::child-2`, or `host-1/child-2`.
* The `:host` selector for imported IDs (via `useid`) may be surpurflous.
   * Imported IDs could start with `::`, or `../`, etc.: `aria-labelledby="::my-imported-handle"`.

The verbosity of the syntax has some **Pros**:
* **Clarity**: more obvious that this is "special" syntax, and not just a developer's naming convention.
* **Learnability**: It is easier to search for "What does ::id mean?" instead of "What does :: mean?"
* **Less likely for ID collisions**: Since this new syntax is being added to the same namespace as IDs, it could help to use a syntax that is unlikely to exist in any current website's IDREFs.

There are also **Cons**:
* **Page size**: Boilerplate text increases the size of the page source code. This affects the transfer time over the wire, but that can be mitigated by compression like gzip. It could also and parsing time/memory consumption, but the effects there may be negligible.
* **Confusion**: The similarities to CSS selectors may indicate that other CSS-like selectors could be used in IDREFs. Also, the syntax is not exactly the same as CSS (e.g. no `#` before the id part: `#host-1::id(child-2)`).
* **More to type**: More keystrokes could be annoying after a while.

<a id="open-question-useids"></a>

### Could the syntax for `useids` be improved?

The `useids` attribute is a part of the public API of a web component, and will be added every time a web component is _used_ (rather than once when the web component is _authored_). As proposed, the value for `useids` is a (potentially long) comma-separated string of name-value pairs. This could be cumbersome for web component users, especially if the string needs to be programmatically generated and/or parsed.

The `Element.useIds` attribute makes the value easier to manage from JavaScript, but it does not help when the values are written in HTML markup, or if markup is generated by a script.

One possible alternative is to declare a family of attributes that begin with `useid-*` or `id-*`, conceptually similar to the `data-*` attributes. Each would declare one custom ID to import to the component. Then, they would be referenced from inside the component with syntax such as `":host[useid-example-import]"`, or `":host::useid(example-import)"`.

For example:

```html
<x-comboboxinput
  useid-labelexample="label-2"
  useid-activeitem="x-listbox-1::id(option-A)"
  useid-dropdownlistbox="x-listbox-1"
>
  #shadowRoot
  | <input
  |   role="combobox"
  |   aria-labelledby=":host[useid-labelexample]"
  |   aria-activedescendant=":host[useid-activeitem]"
  |   aria-controls=":host[useid-dropdownlistbox]"
  |   aria-expanded="true"
  | />
</x-comboboxinput>
```

The equivalent with the `useids` as proposed above would look like this:
```html
<x-comboboxinput 
  useids="labelexample: label-2, activeitem: x-listbox-1::id(option-A), dropdownlistbox: x-listbox-1"
>
  #shadowRoot
  | <input
  |   role="combobox"
  |   aria-labelledby=":host::id(labelexample)"
  |   aria-activedescendant=":host::id(useid-activeitem)"
  |   aria-controls=":host::id(dropdownlistbox)"
  |   aria-expanded="true"
  | />
</x-comboboxinput>
```

**Pros**
- Each imported ID is a separate attribute, which is a more natural syntax, and is easier to read/write if there are many imported IDs.
- No need to do custom string concatenation or parsing if the values are generated by a script.

**Cons**
- Paraphrasing [a comment by @alice](https://github.com/WICG/aom/pull/200#issuecomment-1692489089): there is no precedent for referencing an _attribute_ in the value of another attribute in HTML. For example `aria-labelledby=":host[useid-labelexample]"` is referencing the value of the host's `useid-labelexample` attribute. This "crosses the streams" between attributes and their values.

<a id="open-question-getelementbyid"></a>

### Does `getElementById` need a way to resolve the exported IDREF syntax?

The proposal above does not have a way for `getElementById('host-1::id(child-2)')` to get the actual child element. We don't want to allow this by default because it would break shadow DOM encapsulation. It is already possible to access the element for open shadow roots using the following:

```js
const host = document.getElementById('host-1');
const child = host.shadowRoot.getElementById('child-2');
```

One possibility is to add an argument to `getElementById`, which is a list of shadow roots that may contain the child element. If the actual element is inside one of the provided shadow roots, then it can be returned directly.

```js
const host = document.getElementById('host-1');
const child = document.getElementById('host::id(child-2)', { shadowRoots: [host.shadowRoot] });
```

The main argument against that is that it's more complicated than the original example that called `host.shadowRoot.getElementById('child-2')`, although it does not require potentially parsing out the child ID from a string like `"host-1::id(child-2)"`.

This feature is something that could be added later in a backwards-compatible way, so it may be best to not include it in the initial Export IDs.