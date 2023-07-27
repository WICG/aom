# Element Handles for cross-root ARIA

Author: [Ben Howell](https://github.com/behowell)

## Introduction

The Shadow DOM provides a powerful way to encapsulate web components and keep their implementation details separate from other code on the page. However, this presents a problem for accessibility, which needs to establish semantic relationships between elements on the page. There is currently no way to refer to an element inside another shadow tree from an attribute like `aria-labelledby`. Referring to elements across shadow root boundaries is called "cross-root ARIA", although it affects non-ARIA properties like the label's `for` attribute as well.

For more detailed background on the problem and other proposals to solve it, see Alice Boxhall's article [How Shadow DOM and accessibility are in conflict](https://alice.pages.igalia.com/blog/how-shadow-dom-and-accessibility-are-in-conflict/). 

As laid out in Alice's article, there are separate but related problems to solve:

* [Referring into Shadow DOM](https://alice.pages.igalia.com/blog/how-shadow-dom-and-accessibility-are-in-conflict/#referring-into-shadow-dom): An element in the light tree needs to create a relationship like `aria-activedescendant` to an element inside a shadow tree.
* [Referring from Shadow DOM outwards](https://alice.pages.igalia.com/blog/how-shadow-dom-and-accessibility-are-in-conflict/#referring-from-shadow-dom-outwards): An element inside a shadow tree needs to create a relationship like `aria-labelledby` with an element in the light tree.
* There is also the combined case, where an element in one shadow tree needs to refer to an element in a sibling shadow tree (or any relationship that is not a direct ancestor/descendant relationship). A complete solution should work in this case as well. 
  * An example of when this is needed is described by Nolan Lawson: [ARIA element reflection across non-descendant/ancestor shadow roots](https://github.com/WICG/aom/issues/192).

The cross-root ARIA problem has been discussed for several years, and there have been many proposed solutions. Existing proposals are described below, in the **Alternative Solutions** sections. This proposal draws on the ideas from many of the other proposals.

## Proposal: Element Handles

Element handles are a way to refer to an element inside a shadow tree from an ID reference attribute like `aria-labelledby` or `for`, while preserving shadow DOM encapsulation. Handles can be summed up as "like [shadow parts](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/part), but for ID references." Much of the API is designed to be parallel to the shadow parts API and follows similar syntax. 

**Goals**

* Create a mechanism for elements to refer to each other across shadow root boundaries through ID reference attributes like `aria-labelledby` or `for`.
* The solution should work the same for both closed and open shadow roots.
* Shadow DOM encapsulation should be preserved: Handles are an opaque reference to an element, and don't directly allow access to the underlying element without getting the underlying element from its shadow root, if the shadow root is available.

**Non-Goals**

* Handles are not for CSS styling. That is the role of shadow parts.
* This proposal does not help with aria attributes that aren't ID references, such as `aria-label`.

### Defining handles

Any element can have a handle by setting the attribute `handle="my-handle-name"`. The presence of the attribute makes that element accessible from outside the shadow tree via its handle (no additional exporting is necessary).

An element can have more than one handle, separated by whitespace: `handle="name1 name2 name3"`. However, each handle must be unique within a given shadow root (unlike `part`, which allows more than one element to have the same part name).

Handle names have restrictions on what characters are allowed, to avoid issues when parsing the `::handle()` syntax. The proposal is to only allow letters, numbers, underscores, and hyphens (regex for permitted names: `[A-Za-z0-9_-]+`). However, that restriction could be relaxed to allow other characters in the future.

### Referring to handles

Handle names can be referenced with the syntax "`host-element-id::handle(handle-name)`". The "host-element-id" in the example is the ID of the element that contains the shadow root, and "handle-name" is the handle attribute of an element inside the shadow tree.

Handle references can be used in any attribute that refers to an element by ID, such as `for` or `aria-labelledby`.

> **Note:** It is technically possible (though not recommended) to have an element with an `id` that contains `::handle(...)`, since colon and parentheses are valid characters in an ID. Referring to those elements by ID will continue to work as normal. The lookup algorithm will first check if there is an element with an exact ID match before trying to parse out the handle name.

#### Example 1: Referring into the shadow tree using handles

```html
<label for="x-input-1::handle(the-input)">Example Label</label>
<x-input id="x-input-1">
  #shadowRoot
  | <input handle="the-input" type="text" />
</x-input>
```

### Exporting handles

Exporting handles is only necessary when there are multiple nested shadow trees, and will likely be relatively uncommon. It is not allowed to chain together multiple handles to refer into a nested shadow tree. For example, the following is not valid, and would not match anything: `for="x-combobox::handle(x-input)::handle(the-input)"`. This is to avoid exposing more structure than a component author may desire, and follows the same restrictions as the CSS `::part()` selector. 

Instead, handle names can be exported using `exporthandles` to put them in the "namespace" of the parent component. This works similarly to [`exportparts`](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/exportparts).

Multiple handles can be exported, separated by a comma. Handles can also optionally be renamed: `exporthandles="name1, inner-name2: outer-name2"`.

#### Example 2: Referring through multiple layers of shadow trees

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

The `::handle()` syntax so far only allows referring into a shadow tree from the outside. However, it may also be necessary for an element inside a shadow tree to refer to an element outside. For example, using `aria-labelledby` or `aria-describedby` within a component to refer to external elements outside of the shadow tree.
  
The `importhandles` attribute specifies a mapping from `inner-handle: outer-idref`. The `inner-handle` names are determined by the web component author. The `outer-idref` names are provided by the user of the web component, and can be any element ID or handle using the `id::handle(...)` syntax.

Inside the shadow tree, imported handles are referenced using the `:host::handle()` syntax, using the special ID `:host` to refer to handles imported on the host element. This syntax is analagous to the `:host::part()` CSS selector that can be used to select parts in the local tree.

#### Example 3: Importing handles

This example shows how to import a handle called "my-labelledby" into a the x-input component, and reference it using the ":host" syntax.

```html
<span id="the-span">Example Label</span>
<x-input id="x-input" importhandles="my-labelledby: the-span">
  #shadowRoot
  | <input aria-labelledby=":host::handle(my-labelledby)" type="text" />
</x-input>
```

### Referring across sibling shadow trees

The `importhandles` attribute can also refer to a handle inside another shadow tree. This allows references that don't strictly follow a descendant-ancestor relationship. For example `importhandles="aria-activedescendant: x-listbox-1::handle(active)"`.

#### Example 4: Label and Input in separate shadow trees

In this example, both the `label` and `input` are inside sibling shadow trees. The label uses importhandles and the `::handle()` syntax to connect the two.

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

#### Example 5: A more complicated example of a Combobox

This is a more complex example utilizing several different features of handles. 
* The **x-combobox** component contains an **x-input** and an **x-listbox** component.
* The **x-input** has `exporthandles="the-input"` so that the label's `for` attribute can refer to the input element.
* The **x-input** imports two handles: `my-activedescendant` and `my-listbox`. They are each mapped to a handle inside the **x-listbox**'s shadow tree.
* The **x-listbox** assigns a handle "`active`" to one of the options. Then the listbox can use JavaScript to change which one has the handle. When that happens, the input's `aria-activedescendant` is automatically updated.

```html
<label for="x-combobox-1::handle(the-input)">Example combobox</label>
<x-combobox id="x-combobox-1">
  #shadowRoot
  | <x-input 
  |   exporthandles="the-input"
  |   importhandles="my-activedescendant: x-listbox-1::handle(active), my-listbox: x-listbox-1::handle(the-listbox)">
  |   #shadowRoot
  |   | <input
  |   |   role="combobox"
  |   |   handle="the-input"
  |   |   aria-controls=":host::handle(my-listbox)"
  |   |   aria-activedescendant=":host::handle(my-activedescendant)"
  |   |   aria-expanded="true"
  |   | />
  | </x-input>
  | <button aria-label="Open" aria-expanded="true">v</button>
  |
  | <x-listbox id="x-listbox-1">
  |   #shadowRoot
  |   | <div role="listbox" handle="the-listbox">
  |   |   <div role="option" handle="opt1 active">Option 1</div>
  |   |   <div role="option" handle="opt2">Option 2</div>
  |   |   <div role="option" handle="opt3">Option 3</div>
  |   | </div>
  | </x-listbox>
</x-combobox>
```

### JavaScript API

Supporting handles in JavaScript requires several new APIs and updates to existing APIs.

#### `DocumentFragment.getElementByHandle` method

Find an Element by its handle name in the given document fragment (aka shadow root). Similar to [`DocumentFragment.getElementById`](https://developer.mozilla.org/en-US/docs/Web/API/DocumentFragment/getElementById).

In the event that the referenced handle was an exported handle, this returns the element that has the `exporthandles` attribute, and does _not_ drill into the nested shadow tree. If needed, it is possible for the caller to call `getElementByHandle` again on the returned element's shadow root.

#### `Element.handle` property

A DOMTokenList that reflects the `handle` attribute. Similar to [`Element.part`](https://developer.mozilla.org/en-US/docs/Web/API/Element/part).

#### Example 6: Using `getElementByHandle` and the `handle` property

```html
<x-listbox id="x-listbox-1">
  #shadowRoot
  | <div role="listbox" handle="the-listbox">
  |   <div role="option" handle="opt1 active">Option 1</div>
  |   <div role="option" handle="opt2">Option 2</div>
  |   <div role="option" handle="opt3">Option 3</div>
  | </div>
</x-listbox>
<script>
  const listbox = document.getElementById('x-listbox-1');
  const opt1 = listbox.shadowRoot.getElementByHandle('opt1');
  const opt2 = listbox.shadowRoot.getElementByHandle('opt2');

  console.log(opt1.handle); // ['opt1', 'active']
  console.log(opt2.handle); // ['opt2']

  // Move the active handle to opt2
  opt1.handle.remove('active');
  opt2.handle.add('active');

  console.log(opt1.handle); // ['opt1']
  console.log(opt2.handle); // ['opt2', 'active']
</script>
```

#### `Element.exportHandles` property

A [`DOMStringMap`](https://developer.mozilla.org/en-US/docs/Web/API/DOMStringMap) that reflects the `exporthandles` attribute.

#### Example 7: The `exportHandles` property

```html
<x-input id="x-input-1" exporthandles="the-input, renamed: inner-handle-name">
  #shadowRoot
  | <div>
  |   <input handle="the-input" />
  |   <span handle="inner-handle-name"></span>
  | </div>
</x-input>
<script>
  const xInput = document.getElementById('x-input-1');
  console.log(xInput.exportHandles); // { 'the-input': 'the-input', 'renamed': 'inner-handle-name' }
</script>
```

#### `Element.importHandles` property

A [`DOMStringMap`](https://developer.mozilla.org/en-US/docs/Web/API/DOMStringMap) that reflects the `importhandles` attribute. Allows programmatic access to read and modify the list of imported handles.

This is similar in function to the [`dataset` property](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dataset), except there is no attempt to convert kebab-case to camelCase. All handle names are attributes as-is, and may need to be accessed using the `['']` syntax instead of the dot `.` syntax.

#### Example 8: The `importHandles` property

```html
<x-input id="x-input-1" importhandles="my-listbox: listbox-1, my-activedescendant: listbox-1::handle(active)">
  <!-- ... contents are not important to this example ... -->
</x-input>
<script>
  const xInput = document.getElementById('x-input-1');
  console.log(xInput.importHandles['my-listbox']); // 'listbox-1'
  console.log(xInput.importHandles['my-activedescendant']); // 'listbox-1::handle(active)'
  
  xInput.importHandles['my-listbox'] = 'some-other-listbox';
  delete xInput.importHandles['my-activedescendant'];

  // Changes are reflected back to the attribute
  console.log(xInput.getAttribute('importhandles')); // 'my-listbox: some-other-listbox'
</script>
```

#### Properties that reflect IDREF attributes as strings

Element handles work as expected when setting or getting them on DOMString properties like [`HTMLLabelElement.htmlFor`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/htmlFor). The `::handle()` syntax will continue to work as it does when setting the attributes in HTML markup.

```js
myLabel.htmlFor = 'x-input::handle(the-input)';
console.log(myLabel.htmlFor); // 'x-input::handle(the-input)'
```

#### Properties that reflect IDREF attributes as Element objects

Some JavaScript attributes reflect IDREF attributes into Element objects, such as [`HTMLInputElement.labels`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/labels) or [`Element.ariaActiveDescendantElement`](https://w3c.github.io/aria/#dom-ariamixin-ariaactivedescendantelement) and other properties in ARIAMixin. To preserve encapsulation of the shadow DOM, these cannot return direct references to elements referred to by handles, since those elements may be inside shadow trees that are not accessible to the caller.

When accessing a property that refers to an element via handle, the returned element will be [retargeted](https://dom.spec.whatwg.org/#retarget) in the same way that's done for event targets in shadow DOM. In practice, this is typically the **host element** (i.e. the element specified before `::handle()`), but it is more complex when using `importhandles`.

> **Note**: This solution borrows from Alice Boxhall's recommendation for [Encapsulation-preserving IDL Element reference attributes](https://github.com/WICG/aom/issues/195).

#### Example 9: Accessing handles by JavaScript properties

This is a simplified combobox example, to show how accessing the `ariaActiveDescendantElement` property works when the `aria-activedescendant` attribute references a handle.

```html
<input id="combobox-1" role="combobox" aria-activedescendant="x-listbox-1::handle(opt1)" />

<x-listbox id="x-listbox-1">
  #shadowRoot
  | <div role="listbox" handle="the-listbox">
  |   <div role="option" handle="opt1">Option 1</div>
  | </div>
</x-listbox>

<script>
  const combobox = document.getElementById('combobox-1');
  console.log(combobox.ariaActiveDescendantElement); // <x-listbox id="x-listbox-1">
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
  - This proposal: Element Handles

**Pros**
- No bottleneck effect: different elements in the same shadow DOM can have different values for the same attribute (e.g. two inputs in the shadow DOM can have two different `aria-labelledby` values).
- Re-targeting an attribute like `aria-activedescendant` can be handled by either the developer using the component (by changing the value of `aria-activedescendant`) OR by the component author (by internally moving names to different elements).

**Cons**
- Increased complexity when using a component: need to know some details about the internals of the component to target the correct element (can be published with documentation for the web component).

## Open Questions

### Is the syntax too verbose?

The specifics of the syntax will likely be a long-tail discussion of this proposal. Some early feedback for this proposal has centered around the verbosity of the syntax:

* The `::handle()` part of the IDREF is not strictly necessary.
   * For example: `host-id::handle(the-input)` could instead be shortened to `host-id::the-input`, or `host-id/the-input`.
* The `:host` selector for imported handles seems surpurflous.
   * Imported handles could start with `::`, or `../`, etc.: `aria-labelledby="../my-imported-handle"`.
* For elements with the same value for `id`, `part`, and `handle`, it starts to get redundant:
   * `<input id="my-input" part="my-input" handle="my-input">`

The verbosity of the syntax has some **Pros**:
* **Clarity**: more obvious that this is "special" syntax, and not just a developer's naming convention.
* **Learnability**: It is easier to search for "What does ::handle mean?" instead of "What does :: mean?"
* **Less likely for ID collisions**: Since this new syntax is being added to the same namespace as IDs, it could help to use a syntax that is unlikely to exist in any current website's IDREFs.

There are also **Cons**:
* **Page size**: Boilerplate text increases the size of the page source code. This affects the transfer time over the wire, but that can be mitigated by compression like gzip. It could also and parsing time/memory consumption, but the effects there may be negligible.
* **Confusion**: The similarities to CSS selectors may indicate that other CSS-like selectors could be used in IDREFs. Also, the syntax is not exactly the same as CSS (e.g. no `#` before the id part: `#host-id::handle(the-input)`).
* **More to type**: More keystrokes could be annoying after a while.

See **Appendix A** below for an exploration of possible syntax alternatives.


### Can we export by `id` instead of adding a new `handle` attribute?

Exporting elements from the shadow tree by `id` has the potential to be simpler than creating a new attribute `handle`. The component would need some way to opt into exporting IDs. In the case of `handle`, this is done simply by the existence of the `handle` attribute. Instead, there could be an attribute like `exportid` that makes the ID accessible outside of the shadow root.

See **Appendix A** for an exploration of `exportid`.

### Could the syntax for `importhandles` be improved?

Is it confusing that `importhandles` maps handle names to ids, unlike `exporthandles`, which maps handle names to handle names? It may be worthwhile considering alternative APIs for this. 

Brainstorming a few possible alternatives:
* Rename the attribute to "definehandles" or some other name that doesn't imply it is similar to "exporthandles"
   * `definehandles="handle-name: my-id::handle(my-handle)"`
* Abandon the "handle" naming and call it something like "importids".
   * On the host element: `importids="my-labelledby: my-id::handle(my-handle)`
   * Inside the shadow tree: referred using e.g. `aria-labelledby=":host::importid(my-labelledby)"`
* Use custom attributes for each imported handle, rather than combining them all in one attribute. Similar to `data-*` attributes, these could all have a predefined prefix like `importid-*`:
    ```html
   <label id="the-label">Example Label</label>
   <x-input importid-my-labelledby="the-label">
     #shadowRoot
     | <input aria-labelledby="@importid-my-labelledby" type="text" />
   </x-input>
   ```

See **Appendix A** for an exploration of `importid-*` attributes.

### Does `importhandles` need to support attributes with multiple IDs?

The current syntax for `importhandles` doesn't support referencing multiple IDs from a single handle. This may be important for attributes like `aria-labelledby`, which can reference more than one element. For example, it won't work to write `importhandles="my-labelledby: label1 label2"`.

This limitation would mainly affect component library authors, who want to create general-purpose web components that have parity with built-in controls. For example, it would not be possible to create a `<fancy-input>` that supports having an arbitrary number of elements for its `aria-labelledby`, in the way that the built-in `<input>` does.

One workaround is to define multiple imported handles for each aria attribute. However, this requires the component to be specifically designed to support multiple handles, and still is limited to the number of elements that the component author supports. For example, with two labels:

```html
<label id="label1">Label 1</label>
<label id="label2">Label 2</label>
<x-input importhandles="my-label1: label1, my-label2: label2">
  #shadowRoot
  | <input aria-labelledby=":host::handle(my-label1) :host::handle(my-label2)" type="text">
</x-input>
```

The only reason this restriction exists is because a single handle can't refer to multiple elements. This may be a further argument to change `importhandles` to something like `importids`, and allow a single import could refer to multiple IDs.

### Is there a need for a JavaScript object representation of a handle?

There may be a need for a more advanced JavaScript API that allows interacting with element handles. It is not clear whether such an API is truly necessary. Are there good motivating examples that require this level of access to handles. Most cases should just be able to use the string representation of a handle.

The goals of such an API would be:
* Create a JavaScript object that represents `"host-element::handle(handle-name)"` in a way that does not break shadow DOM encapsulation (no direct access to the element that the handle refers to without having access to its shadow root). 
* Work in a compatible way with properties of type `Element`, like [`Element.ariaActiveDescendantElement`](https://w3c.github.io/aria/#dom-ariamixin-ariaactivedescendantelement).

One option is to have an `ElementHandle` simply be a mixin with `Element`, which adds a single property: `targetHandle` (readonly) the handle name as a string. The `targetHandle` property needs to be readonly, since changing the `targetHandle` would change the identity of the ElementHandle (change what element it refers to).

Creating an element handle programmatically would require a special function like `document.createElementHandle(hostElement, handleName)`. 

In that case, code that is unaware of `ElementHandle` would just see the host element. But if the code checks for `targetHandle`, it can work with it as appropriate.

```html
<input id="combobox-1" role="combobox" aria-activedescendant="x-listbox-1::handle(opt1)" />

<x-listbox id="x-listbox-1">
  #shadowRoot
  | <div role="listbox" handle="the-listbox">
  |   <div role="option" handle="opt1">Option 1</div>
  |   <div role="option" handle="opt2">Option 2</div>
  | </div>
</x-listbox>

<script>
  const combobox = document.getElementById('combobox-1');

  let activeDescendant = combobox.ariaActiveDescendantElement;
  console.log(activeDescendant); // <x-listbox id="x-listbox-1">
  console.log(activeDescendant.targetHandle); // 'opt1'

  // If the shadowRoot is open, it is possible to get the actual element referenced by the handle:
  const resolvedTarget = activeDescendant.shadowRoot?.getElementByHandle(activeDescendant.targetHandle);
  console.log(resolvedTarget); // <div role="option" handle="opt1">Option 1</div>

  // The attributes also allow an ElementHandle to be set on them
  combobox.ariaActiveDescendantElement = document.createElementHandle(document.getElementById('x-listbox-1'), 'opt2');
</script>
```


## Appendix A: Rename this feature `exportid`, and syntax alternatives

One goal of naming this feature `handle` is to make it clearer that it is distinct from IDs, and can't be interchanged with IDs. However, given the similar purpose, it may be ok and even desirable to give it a name that is similar to ID.

This appendix explores what this proposal would look like if `handle` were renamed to `exportid`, and the syntax for `importhandles` and IDREFs were changed. It may be desired to mix and match the syntax from the main proposal and this appendix.

Consider the same proposal as above, with these changes:
* Rename HTML Attributes
  * `handle` => `exportid`
  * `exporthandles` => `reexportids`
  * `importhandles` => `importid-*` family of custom attributes, similar to `data-*`
* Update IDREF syntax
  * `"my-host::handle(my-element)"` => `"my-host::my-element"`
  * `":host::handle(my-label)"` => `"@importid-my-label"`
* Rename JavaScript methods/attributes
  * `getElementByHandle` => `getElementByExportId`
  * `handle` => `exportId`
  * `exportHandles` => `reexportIds`
  * `importHandles`=> `importIds`
* If the attribute `exportid` is specified but has no value, then it defaults to the `id`. For example, the following three are equivalent in terms of the exportid:
  * `<input id="the-input" exportid />`
  * `<input id="the-input" exportid="the-input" />`
  * `<input exportid="the-input" />`

Rewriting the examples from above in this syntax would look like this:

#### Example 1a: Referring into the shadow tree using exportid

```html
<label for="x-input-1::the-input">Example Label</label>
<x-input id="x-input-1">
  #shadowRoot
  | <input exportid="the-input" type="text" />
</x-input>
```

#### Example 2a: Referring through multiple layers of shadow trees

```html
<label for="x-combobox::the-input">Example Label</label>
<x-combobox id="x-combobox">
  #shadowRoot
  | <x-input id="x-input" reexportids="the-input">
  |   #shadowRoot
  |   | <input id="the-input" exportid type="text" />
  | </x-input>
</x-combobox>
```

#### Example 3a: Importing IDs

```html
<span id="the-span">Example Label</span>
<x-input id="x-input" importid-my-labelledby="the-span">
  #shadowRoot
  | <input aria-labelledby="@importid-my-labelledby" type="text" />
</x-input>
```

#### Example 4a: Label and Input in separate shadow trees

```html
<x-label id="x-label" importid-label-for="x-input::the-input">
  #shadowRoot
  | <label for="@importid-label-for">Example Label</label>
</x-label>
<x-input id="x-input">
  #shadowRoot
  | <input exportid="the-input" type="text" />
</x-input>
```

#### Example 5a: Combobox

```html
<label for="x-combobox-1::the-input">Example combobox</label>
<x-combobox id="x-combobox-1">
  #shadowRoot
  | <x-input 
  |   reexportids="the-input"
  |   importid-activedescendant="x-listbox-1::active"
  |   importid-listbox="x-listbox-1::the-listbox">
  |   #shadowRoot
  |   | <input
  |   |   role="combobox"
  |   |   id="my-internal-id"
  |   |   exportid="the-input"
  |   |   aria-controls="@importid-listbox"
  |   |   aria-activedescendant="@importid-activedescendant"
  |   |   aria-expanded="true"
  |   | />
  | </x-input>
  | <button aria-label="Open" aria-expanded="true">v</button>
  |
  | <x-listbox id="x-listbox-1">
  |   #shadowRoot
  |   | <div role="listbox" exportid="the-listbox">
  |   |   <div role="option" id="opt1" exportid="opt1 active">Option 1</div>
  |   |   <div role="option" id="opt2" exportid>Option 2</div>
  |   |   <div role="option" id="opt3" exportid>Option 3</div>
  |   | </div>
  | </x-listbox>
</x-combobox>
```

#### Example 6a: Using `getElementByExportId` and the `exportId` property

```html
<x-listbox id="x-listbox-1">
  #shadowRoot
  | <div role="listbox" exportid="the-listbox">
  |   <div role="option" id="opt1" exportid="opt1 active">Option 1</div>
  |   <div role="option" id="opt2" exportid>Option 2</div>
  |   <div role="option" id="opt3" exportid>Option 3</div>
  | </div>
</x-listbox>
<script>
  const listbox = document.getElementById('x-listbox-1');
  const opt1 = listbox.shadowRoot.getElementByExportId('opt1');
  const opt2 = listbox.shadowRoot.getElementByExportId('opt2');

  console.log(opt1.exportId); // ['opt1', 'active']
  console.log(opt2.exportId); // ['opt2']

  // Move the active exportId to opt2
  opt1.exportId.remove('active');
  opt2.exportId.add('active');

  console.log(opt1.exportId); // ['opt1']
  console.log(opt2.exportId); // ['opt2', 'active']
</script>
```

#### Example 7: The `reexportIds` property

```html
<x-input id="x-input-1" reexportids="the-input, renamed-span: the-span">
  #shadowRoot
  | <div>
  |   <input exportid="the-input" />
  |   <span exportid="the-span"></span>
  | </div>
</x-input>
<script>
  const xInput = document.getElementById('x-input-1');
  console.log(xInput.reexportIds); // { 'the-input': 'the-input', 'renamed-span': 'the-span' }
</script>
```

#### Example 8a: The `importIds` property

> _Note_: This may not be necessary? Would it work to just use `getAttribute`/`setAttribute` on the `importid-*` attributes instead?

```html
<x-input id="x-input-1" importid-my-listbox="listbox-1" importid-my-activedescendant="listbox-1::active">
  <!-- ... contents are not important to this example ... -->
</x-input>
<script>
  const xInput = document.getElementById('x-input-1');
  console.log(xInput.importIds['my-listbox']); // 'listbox-1'
  console.log(xInput.importIds['my-activedescendant']); // 'listbox-1::active'
  
  xInput.importIds['my-listbox'] = 'some-other-listbox';
  delete xInput.importIds['my-activedescendant'];

  // Changes are reflected back to the attributes
  console.log(xInput.getAttribute('importid-my-listbox')); // 'some-other-listbox'
  console.log(xInput.getAttribute('importid-my-activedescendant')); // null
</script>
```