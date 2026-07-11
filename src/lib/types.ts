export type Workspace = {
  id: string;
  name: string;
  owner_id: string;
  plan: "trial" | "starter" | "professional" | "agency";
  plan_expires_at: string | null;
};

export type Brand = {
  id: string;
  workspace_id: string;
  name: string;
  industry: string | null;
  products: string[];
  services: string[];
  usp: string | null;
  target_audience: string[];
  competitors: string[];
  tone_of_voice: string | null;
  brand_values: string | null;
};
