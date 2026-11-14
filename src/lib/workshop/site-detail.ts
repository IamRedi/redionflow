import type { TreeCardItem } from "@/components/demo/workshop/muster-tree-grid";

export type MusterSiteData = {
  id: string;
  siteKey: string;
  name: string;
  address: string | null;
  description: string | null;
  trees: TreeCardItem[];
  points: { id: string; treeId: string; status: string; lat: number; lng: number }[];
  crew: { id: string; name: string }[];
  safety: { label: string; quantity: number }[];
  tasks: string[];
  briefing?: string;
  now: string;
};
