type RowHeaderProps = {
  row: number;
};

export function RowHeader({ row }: RowHeaderProps) {
  return <span>{row + 1}</span>;
}
