import { columnName } from "@/lib/grid";

type ColumnHeaderProps = {
  col: number;
};

export function ColumnHeader({ col }: ColumnHeaderProps) {
  return <span>{columnName(col)}</span>;
}
