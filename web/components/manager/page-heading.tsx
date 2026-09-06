import type { ReactNode } from "react";
import { PageHeader, type PageHeaderProps } from "@/components/layout/page-header";

export type PageHeadingProps = PageHeaderProps & {
  title: string;
  description: string;
  action?: ReactNode;
};

export function PageHeading(props: PageHeadingProps) {
  return <PageHeader {...props} />;
}

