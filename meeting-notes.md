## 25 March 2020

Present: Alice Boxhall, James Craig, Ryosuke Niwa

### Discussing [Element Reflection](https://github.com/whatwg/html/issues/4925)

- General agreement that 
  [Option 1.1](https://gist.github.com/alice/174ae481dacdae9c934e3ecb2f752ccb#option-11-any-element-reference-in-the-same-document-is-valid) is a workable solution.
- Performing cleanup on `adoptNode()` is the simpler approach out of the two discussed there, particularly since `WeakRef` 
  will have inconsistencies as discussed in 
  [Ryosuke's comment](https://github.com/whatwg/html/issues/4925#issuecomment-601477644)
- All agree referencing across documents is unlikely to be useful, no developers have been asking for this.
- Discussion of a similar problem in Web Components: [Imperative Shadow DOM Distribution API](https://github.com/whatwg/html/issues/3534)
   - This involves using a JS DOM API to assign a node to a slot
   - Current 
     [proposal](https://github.com/w3c/webcomponents/blob/ef4b3fbafddfe07c2be616e4722f6799d88fc82c/proposals/Imperative-Shadow-DOM-Distribution-API.md#examples)
     looks like:
     ```js
     assert_array_equals(slot.assignedNodes(), []);
     slot.assign([A]);
     assert_array_equals(slot.assignedNodes(), [A]);
     ```
     i.e. explicit setter and getter methods.
   - This is analogous to the [IDREFS](https://www.w3.org/TR/2004/REC-xmlschema-2-20041028/#IDREFS) case for ARIA properties
- Suggest using `.assign()`/`.assignedNodes()` for these properties as well, e.g.
  ```js
  el.ariaLabelledByElements.assign([label1, label2]);
  assert_array_equals(el.ariaLabelledByElements.assignedNodes(), [label1, label2]);
  ```
  - Noting that "assignment" has a specific meaning for slots, but it seems to work just as well here and is consistent.
  - We want to avoid a situation like `getElementsByClassname()` where the return type changes depending on the number of elements -
    should only ever return an array
  - May want to be even more explicit in property naming, e.g. `ariaLabelledByElementList`
  - [Proposal](https://github.com/w3c/webcomponents/blob/ef4b3fbafddfe07c2be616e4722f6799d88fc82c/proposals/Imperative-Shadow-DOM-Distribution-API.md#htmlslotelement) 
    for HTML spec change is to modify the `HTMLSlotElement` API; we would need to create a new object type for the IDREFS-type properties.
- Single `Node`/IDREF-type properties would still be like `el.ariaActiveDescendantElement = el1` - no need for a special API for these

### Discussing open questions remaining from [original design questions issue](https://github.com/whatwg/html/issues/4925)

1. In general, when and how should an _attr_-association have distinct behaviour from a regular (expando) JavaScript property 
   on an Element DOM object?
   - The reason for the difference is that the _attr_-association needs to be implemented in the browser engine, 
   and can't take advantage of the JS engine's garbage collection.
2. Should an _attr_-association be allowed to be created, or persist under circumstances when it can't have an effect? 
   For example, a `<label>` `for` relationship where the `<label>` has been removed from the tree (or is yet to be added) 
   and thus can't act as a label.
   - Yes, given the developer requirement to create relationships between elements not yet in the tree.
3. Should an _attr_-association be treated like a regular javascript reference for the purposes of garbage collection? 
   i.e. if the _attr_-association is the last remaining reference to an Element object which has been removed from the tree, 
   should that Element object be considered garbage?
   - (We did not discuss this.)
4. How should _attr_ associations behave across Shadow DOM boundaries?
   - This is the major outstanding issue

### Discussing interaction between element reflection and Shadow DOM

- Ryosuke believes that referring into deeper shadow scopes is unacceptable and should be prevented by the API
- Alice is not opposed to preventing referring into deeper shadow scopes, 
  but thinks the implementation complexity added by enforcing that rule outweighs the benefits.
  - Unlike other APIs which enforce encapsulation (such as event path), 
    it's not possible for the _browser_ to accidentally leak implementation details - 
    an author would have to create the association themselves - breaking their _own_ encapsulation.
    - Ryosuke believes there are counter-examples to this, and will follow up.
  - This is analogous to sharing a pointer to a private member in C++ - this is poor programming practice,
    but is not prevented by the language.
  - The same "encapsulation leak" is currently possible using expando properties.

### Action items

- Alice will write up a proposal for the APIs discussed in this meeting, 
  and update the bug to reflect the current state of discussions.
- Alice will open a new issue to discuss the shadow DOM interaction topic specifically
- Ryosuke has proposed a one-off workshop to discuss custom elements and accessibility.


