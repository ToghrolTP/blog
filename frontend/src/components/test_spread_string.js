const editingProduct = { metadata: "{\"author\":\"Bob\"}" };
const newMeta = { ...editingProduct.metadata, author: "Alice" };
console.log(newMeta);
