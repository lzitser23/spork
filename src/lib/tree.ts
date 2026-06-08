export interface TreeNode {
  name: string;
  /** Full repo-relative path. */
  path: string;
  dir: boolean;
  children: TreeNode[];
}

/** Build a nested folder/file tree from a flat list of repo-relative paths. */
export function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", dir: true, children: [] };

  for (const p of paths) {
    const parts = p.split("/");
    let node = root;
    let acc = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      acc = acc ? `${acc}/${part}` : part;
      const isFile = i === parts.length - 1;
      let child = node.children.find((c) => c.name === part);
      if (!child) {
        child = { name: part, path: acc, dir: !isFile, children: [] };
        node.children.push(child);
      }
      node = child;
    }
  }

  sortTree(root);
  return root.children;
}

/** Folders first, then files; each alphabetical. */
function sortTree(node: TreeNode): void {
  node.children.sort((a, b) =>
    a.dir !== b.dir ? (a.dir ? -1 : 1) : a.name.localeCompare(b.name),
  );
  node.children.forEach(sortTree);
}
