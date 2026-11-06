/** A reference to another record: enough to show its name and link to it. */
export interface NamedRef {
  id: string;
  name: string;
}

/** A row of a catalogue (departments, positions): a name and the code other records quote. */
export interface CatalogItemView {
  id: string;
  name: string;
  code: string;
  createdAt: Date;
  updatedAt: Date;
}
