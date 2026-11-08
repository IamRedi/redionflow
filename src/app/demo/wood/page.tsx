import { notFound } from "next/navigation";
import { requireWorkshopDemo } from "@/lib/workshop/shared-store";
import { WoodWorkspace } from "@/components/demo/workshop/wood-workspace";
export default async function WoodPage(){try{await requireWorkshopDemo();}catch{notFound();}return <WoodWorkspace/>;}
