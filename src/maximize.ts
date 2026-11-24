import { applyLayout } from "./layout";

export default async function Command() {
  await applyLayout("maximize");
}
