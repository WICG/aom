# Element reference DOM properties

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Introduction](#introduction)
- [Single vs. multiple element properties](#single-vs-multiple-element-properties)
- [Reflection to HTML attributes](#reflection-to-html-attributes)
  - [Computing element references from HTML attributes](#computing-element-references-from-html-attributes)
  - [Warning on potentially confusing property getter behaviour](#warning-on-potentially-confusing-property-getter-behaviour)
- [Element reference properties and Shadow DOM](#element-reference-properties-and-shadow-dom)
- [Valid vs. invalid references](#valid-vs-invalid-references)
  - [Elements not in the DOM tree](#elements-not-in-the-dom-tree)
  - [Invalid references in Element array properties](#invalid-references-in-element-array-properties)
- [Element reference properties and the accessibility tree](#element-reference-properties-and-the-accessibility-tree)
- [Removing Element reference properties](#removing-element-reference-properties)
- [Element reference properties and garbage collection](#element-reference-properties-and-garbage-collection)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Introduction

Element reference DOM properties will allow you to create associations between elements,
like [ID reference attributes](https://w3c.github.io/aria/#valuetype_idref),
but using the element reference directly.

For example, if you had this structure:

```html
<label>
  Phone number:
  <input type="tel">
</label>
<span id="description">Please include international country code, e.g. +61</span>
```

You could associate the input with the description using the DOM API:

```js
const input = document.querySelector('input');
const description = document.getElementById('description');

input.ariaDescribedByElements = [description];
```

This is a simplified example,
but this allows complex, dynamic interfaces
to use attributes like [`aria-activedescendant`](https://w3c.github.io/aria/#aria-activedescendant)
and [`aria-owns`](https://w3c.github.io/aria/#aria-owns)
to convey the current state without complex book-keeping of unique IDs:

```js
tree.addEventListener('keydown', (event) => {
  // Extremely simplified example code, don't copy this!
  switch (event.code) {
    case "ArrowUp":
      const previous = tree.getPreviousItem(tree.selectedItem);

      // No need to generate a unique ID to use aria-activedescendant
      tree.ariaActiveDescendantElement = previous;

      previous.ariaSelected = true;
      tree.selectedItem.ariaSelected = false;
      tree.selectedItem = previous;
      break;

    // etc.
  }
});
```

## Single vs. multiple element properties

The first example above uses `ariaDescribedByElements`,
which corresponds to [`aria-describedby`](https://w3c.github.io/aria/#aria-describedby).
`aria-describedby` takes a list of space-separated IDs
(an [ID reference list](https://w3c.github.io/aria/#valuetype_idref_list)),
to refer to one or more Elements.

To allow the DOM property to express this,
it always takes and returns an Array of Elements
(and the name includes "Elements", plural, to reflect this).

The second example uses `ariaActiveDescendantElement`,
which corresponds to [`aria-activedescendant`](https://w3c.github.io/aria/#aria-activedescendant).

`aria-activedescendant` takes a single
[ID reference](https://w3c.github.io/aria/#valuetype_idref),
so `ariaActiveDescendantElement` takes and returns
either a single Element reference,
or `null`.
The name includes "Element", singular, to reflect this.

## Reflection to HTML attributes

Element reference properties will reflect to their corresponding HTML attributes.

For example, in the simple form above:

```html
<label>
  Phone number:
  <input type="tel">
</label>
<span id="description">Please include international country code, e.g. +61</span>
```

After setting the `ariaDescribedByElements` property:

```js
input.ariaDescribedByElements = [description];
```

The live HTML structure will now reflect this:

```html
<label>
  Phone number:
  <input type="tel" aria-describedby="description">
</label>
<span id="description">Please include international country code, e.g. +61</span>
```

That is, if the element being referred to _does_ have an ID,
it will set the attribute to the same value you'd use to create an IDREF association.

If the referenced element _doesn't_ have an ID,
or it isn't in the same ID scope as the host element,
then the HTML attribute will have an empty string value:

```html
<label>
  Phone number:
  <input type="tel" aria-describedby>
</label>
<span>Please include international country code, e.g. +61</span>
```

In either case, removing the HTML attribute will also clear the DOM property:

```js
input.removeAttribute('aria-describedby');
console.log(input.ariaDescribedByElements);  // null
```


### Computing element references from HTML attributes
If you set the HTML attribute directly,
whether via `setAttribute` or directly in the HTML source,
the corresponding DOM property will be computed at the time it is accessed:

```html
<ul id="radiogroup" role="radiogroup" aria-activedescendant="item-1" tabindex="0">
  <li role="radio" aria-checked="true" id="item-1">Item #1</li>
  <li role="radio" aria-checked="false" id="item-2">Item #2</li>
  <li role="radio" aria-checked="false" id="item-3">Item #3</li>
</ul>
```

```js
console.log(radiogroup.getAttribute('aria-activedescendant'));    // logs "item-1"
console.log(radiogroup.ariaActiveDescendantElement.textContent);  // logs "Item #1"
```

If the HTML attribute isn't present,
the corresponding DOM property will be `null`
(for both single and multiple Element properties):

```js
const radio1 = document.getElementById('item-1');
console.log(radio1.ariaActiveDescendantElement);  // logs null
console.log(radio1.ariaLabelledByElements);       // logs null
```

If the HTML attribute is present,
but doesn't contain any valid IDs,
_and_ the DOM property wasn't set directly,
then the DOM property will be `null` for a single Element property,
or an empty Array for a multiple Element property:

```html
<li id="item" role="radio" aria-activedescendant="invalid" aria-labelledby="invalid">Item X</li>
```

```js
const item = document.getElementById('item');
console.log(item.ariaActiveDescendantElement);  // logs null
console.log(item.ariaLabelledByElements);       // logs []
```

---

### Warning on potentially confusing property getter behaviour

**Warning:** The value returned from the DOM property getter can occasionally depend on _how it was set_.

For example, if you started with this structure:

```html
<ul id="radiogroup" role="radiogroup" aria-activedescendant="item-2" tabindex="0">
  <li role="radio" aria-checked="true" id="item-1">Item #1</li>
  <li role="radio" aria-checked="false" id="item-2">Item #2</li>  <!-- active descedant -->
  <li role="radio" aria-checked="false" id="item-3">Item #3</li>
</ul>
```

And then changed the ID of the first radio to be the same as the second:

```js
const firstOption = radiogroup.firstElementChild;
firstOption.id = "item-2";
```

```html
<ul id="radiogroup" role="radiogroup" aria-activedescendant="item-2" tabindex="0">
  <li role="radio" aria-checked="false" id="item-2">Item #1</li>  <!-- same ID as active descendant -->
  <li role="radio" aria-checked="true" id="item-2">Item #2</li>   <!-- active descendant? -->
  <li role="radio" aria-checked="false" id="item-3">Item #3</li>
</ul>
```

Then, if you had set the `aria-activedescendant` attribute directly
(either using `setAttribute()`, or directly in the HTML source),
this would be the result:

```js
console.log(radiogroup.getAttribute('aria-activedescendant'));    // logs "item-2"
console.log(radiogroup.ariaActiveDescendantElement.textContent);  // logs "Item #1"
```

However, if you had set the second `<li>` as the `ariaActiveDescendantElement` property,
that would also have set the `aria-activedescendant` attribute to `"item-2"`,
but if you changed the IDs after that,
the `ariaActiveDescendantProperty` will still return the second `<li>`:

```js
console.log(radiogroup.getAttribute('aria-activedescendant'));    // logs "item-2"
console.log(radiogroup.ariaActiveDescendantElement.textContent);  // logs "Item #2"
```

To avoid this confusion, follow HTML best practices:
* **avoid changing IDs**, and
* **avoid having multiple elements with the same ID**.

---

## Element reference properties and Shadow DOM

Unlike ID reference attributes,
element reference properties can refer to elements across Shadow DOM boundaries
(with restrictions).

If you wanted to create a custom combobox,
which contains an `<input>` element inside shadow DOM,
and autocomplete options which are provided via a `<slot>`,
you might end up with a structure something like this:

```html
<custom-combobox>
  #shadow-root (open)
  |  <input>
  |  <slot></slot>
  #/shadow-root
  <custom-optionlist>
    <x-option id="opt1">Option 1</x-option>
    <x-option id="opt2">Option 2</x-option>
    <x-option id='opt3'>Option 3</x-option>
 </custom-optionlist>
</custom-combobox>
```

You would want to set the currently selected autocomplete option
as the `aria-activedescendant` for the `<input>`,
but an IDREF association won't work
because the Shadow Root creates a separate scope for IDs.

However, you can still use the `ariaActiveDescendantElement` property
to create the association:

```js
// (Assume you already have the JS variables set up correctly)
input.ariaActiveDescendantElement = opt1;

console.log(input.ariaActiveDescendantElement.id);          // logs "opt1";

// Since opt1 is in a different scope, the attribute value is empty string
console.log(input.getAttribute('aria-activedescendant')));  // logs "";
```

## Valid vs. invalid references

An element may refer to another element as long as the referenced element is
_a descendant of any shadow-including ancestor_ of the host element.

_"Shadow-including ancestor"_ means any element
which is an ancestor, taking Shadow DOM into account.

For example, in the `<custom-combobox>` example above,
a reference from the `<input>` to `opt1` is valid:
`opt1` is a descendant of the `<custom-combobox>` element,
which is a _shadow-including_ ancestor of the `<input>` element.

However, a reference _from_ `opt1` _to_ the `<input>` element
is _not_ valid,
since the `<input>` element isn't a direct ancestor of `<custom-combobox>`.

If a reference isn't valid,
getting the DOM property value won't return the referenced element,
but instead will return `null` for single Element properties,
or remove the referenced Element from the Array returned
for multiple Element properties.

If you tried:

```js
// There's literally no reason you'd even think about doing
// any of this, but if you did...
opt1.ariaActiveDescendantElement = input;

console.log(opt1.getAttribute("aria-activedescendant"));  // logs ""
console.log(opt1.ariaActiveDescendantElement);            // logs null

opt1.ariaControlsElements = [input];

console.log(opt1.getAttribute("aria-controls"));  // logs ""
console.log(opt1.ariaControlsElements);           // logs []
```

... the HTML attribute gets set,
but you can't get the `<input>` element reference from the DOM property.

If you did somehow manage to move the `<input>` element
into the same scope as `opt1`,
you would then see it as the return value of the DOM property:

```js
opt1.parentElement.appendChild(input);

console.log(opt1.ariaControlsElements);         // logs [input];
console.log(opt1.ariaActiveDescendantElement);  // logs input;
```

### Elements not in the DOM tree

If you have an association between a host and a referenced element:

```html
<div id="container">
  <ul id="radiogroup" role="radiogroup" tabindex="0">
    <li role="radio" aria-checked="false" id="item-1">Item #1</li>
    <li role="radio" aria-checked="true" id="item-2">Item #2</li>
    <li role="radio" aria-checked="false" id="item-3">Item #3</li>
  </ul>
</div>
```

```js
const radiogroup = document.getElementById('radiogroup');
radiogroup.ariaActiveDescendantElement = document.getElementById('item-2');
```

If you remove _either_ the host element, or the referenced element
from the document:

```js
document.getElementById('item2').remove();
```

... then it's no longer the case that the referenced element
is _a descendant of a shadow-including ancestor_ of the host element.
Because of this,
the `actiaActiveDescendantElement` property getter
will return `null`:

```js
console.log(radiogroup.ariaActiveDescendantElement);  // logs null
```

However, if you remove a common ancestor of both elements,
then the relationship is still valid:

```
const container = document.getElementById('container');
container.remove();

console.log(radiogroup.ariaActiveDescendantElement);  // logs null
```

### Invalid references in Element array properties

If an Element array property
(corresponding to an
[ID reference list](https://w3c.github.io/aria/#valuetype_idref_list)
attribute)
contains multiple Elements,
the getter will return

For example, if you had a radio group,
and wanted to use `ariaOwnsElements` to modify
the order of the radios in the accessibility tree,
you could do something like this:

```html
<ul id="radiogroup" role="radiogroup" >
  <li role="radio" aria-checked="true">Item #3</li>
  <li role="radio" aria-checked="false">Item #1</li>
  <li role="radio" aria-checked="false">Item #2</li>
</ul>
```

```js
const radios = radiogroup.querySelectorAll('li');
radiogroup.ariaOwnsElements = [ radios[2], radios[3], radios[1] ];

for (let radio of radiogroup.ariaOwnsElements) {
 console.log(radio.textContent);  // logs consecutively "Item #1", "Item #2" and "Item #3"
}
```

If you made the radio Element with text content "Item #2" invalid
(i.e. the third radio Element),
such as by removing it from the DOM tree,
`ariaOwnsElements` would still return the other two Elements:

```js
radios[3].remove();

for (let radio of radiogroup.ariaOwnsElements) {
 console.log(radio.textContent);  // logs consecutively "Item #1" and "Item #3"
}
```

## Element reference properties and the accessibility tree

Accessibility tree computation is (indirectly)
based on the computed value of the relelvant DOM property.

For example, in the `radiogroup` example above,
when `ariaOwnsElements` is initially set,
the accessibility tree would have nodes named
"Item #1", "Item #2" and "Item #3",
in that order,
as the children of the node corresponding to the
`<ul role="radiogroup">` Element.

After the node with text content "Item #2" is removed from the document,
it would only have as children
nodes named "Item #1" and "Item #3", in that order.

The accessibility tree computation may take other things into account
when determining what to expose,
but this doesn't affect what the DOM property getter will return.

For example, if the radio Element with text content "Item #1"
had an `aria-hidden="true"` attribute,
it wouldn't be exposed as a child of the radiogroup in the accessibility tree,
but it wouldn't change what the `ariaOwnsElements` property getter would return.

## Removing Element reference properties

You can remove an Element reference property two ways:

1) By removing the HTML attribute, or
2) By setting the DOM property to `null`
(for both single and multiple Element reference properties).

Even if a property becomes _invalid_,
it won't be removed altogether unless you do one of these two things.

## Element reference properties and garbage collection

An Element reference property
doesn't cause an Element to be retained
by the JavaScript engine's garbage collection process.

For example, if you remove an element from the DOM
which is referred to by another element's `ariaActiveDescendantElement` property,
but not referred to in any active JavaScript context,
that element may be garbage collected at any point.

This means that not clearing DOM property references
to Elements which aren't going to be re-inserted in the DOM
(since you would have to have an active reference to them to do that)
has no impact on memory usage.

