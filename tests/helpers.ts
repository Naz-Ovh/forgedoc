/**
 * Shared helpers for the browser tests.
 *
 * why `document.body.append` of a fully-built subtree rather than assigning
 * `innerHTML` on an already-attached node: it reproduces the delivery contract
 * exactly (§5.2). Elements upgrade once, synchronously, in tree order, with all
 * of their children already present — which is what lets components assume
 * children exist at upgrade time.
 */

/** Build a `plan-doc` from markup and attach it, returning the upgraded root. */
export function mountPlan(innerMarkup: string, attributes = 'plan-id="test-plan"'): HTMLElement {
  const holder = document.createElement('div');
  holder.innerHTML = `<plan-doc ${attributes}>${innerMarkup}</plan-doc>`;

  const planDoc = holder.firstElementChild as HTMLElement;
  document.body.append(planDoc);
  return planDoc;
}

/** Mount, then run the runtime over the same document a second time. */
export function mountTwice(innerMarkup: string, attributes?: string): HTMLElement {
  const planDoc = mountPlan(innerMarkup, attributes);

  // MUST (§7.2): re-running the runtime on a live document changes nothing.
  // Re-attaching fires connectedCallback again on every element in the subtree.
  planDoc.remove();
  document.body.append(planDoc);
  customElements.upgrade(planDoc);
  return planDoc;
}

/** Every element and text node in the subtree, for identity comparisons. */
export function snapshotNodes(root: Element): Node[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  const nodes: Node[] = [];
  let node = walker.nextNode();
  while (node) {
    nodes.push(node);
    node = walker.nextNode();
  }
  return nodes;
}

/**
 * Author nodes that must survive `enhance()` untouched.
 *
 * Chrome the runtime appends is excluded, so this is exactly the set §2.2
 * protects: nodes the agent wrote.
 */
export function authorNodesOf(root: Element): Node[] {
  return snapshotNodes(root).filter((node) => {
    if (!(node instanceof HTMLElement)) return true;
    return node.dataset.planChrome === undefined;
  });
}

/** Wait for the store's debounced write plus a paint. */
export function settle(milliseconds = 320): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
