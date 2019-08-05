# Highlight modules in help mode

## Context

In help mode, we needed to highlight modules to show that they have help associated with them.

### Requirements
1. Highlight each module with a dashed border + "help" mouse pointer
2. Mask its contents to block user interactions with the module itself. Clicking on a mask opens the help frame.
3. Modules without help should not be clickable. If nested inside another module, we'll pass this responsibility to the parent module (otherwise the parent might have help and we'll block part of it with the mask for the child).

### Invariants
1. Module content is unknown and may contain one or more elements
2. Module may break out of its parent container (e.g. account accordion with negative margin)
3. Module layout is unknown (we might have flex-grow - e.g. sidebar block list, absolute position etc.)
4. There are layout dependencies between parent and child (e.g. flex, grid, height: 100%, position: absolute)

## Problem statement

To implement the requirements, we need to solve two generic sub-problems:

**Sub-problem 1**: Apply highlighting to an element

Considered options:
- Option 1: Apply inline styles (border/outline) to the element itself
- Option 2: Wrap the element with another element on which we add the above styles
- Option 3: Create a proxy element that we manually position on top of the target element

**Sub-Problem 2**: Mask an element and intercept interactions

Considered options:
- ~~Option 1: Use a capture-phase click handler with stopPropagation => doesn't appear to work at all~~
- Option 2: Create a mask element as a child of target element with `position: absolute`; target receives `position: relative`. Variant: Wrap the target with a div and place the mask as a sibling of the target.
- Option 3: Create a separate mask element in body and position it on top of target element and above everything else. Need to calculate z-indexes manually for each element based on target position on the page.

## Considered options

Options that satisfy both sub-problems:
- ~~Option 1: Mask element as child of target, apply `position: relative` directly to target~~ *=> doesn't work, React can't access DOM elements inside function components*
- Option 2: Wrap target with an element that has `position: relative` and add mask as sibling to the target module. Allow module author to define wrapper CSS styles, to prevent breaking layout. Wrapper is still going to be a breaking change.
- Option 3: Mask element in body with manual position/sync

## Decision outcome

Chose `Option 2` because

* `Option 1` is only possible if an explicit target is given by module author for every single module. Inconvenient and also error-prone because we alter styles on elements that we don't control. Very hackish to implement.

* `Option 3` is too complex and we still need an explicit target regardless of how many elements are in the module.
