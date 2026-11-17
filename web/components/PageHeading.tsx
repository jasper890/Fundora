type Props = {
  title: string;
  lead?: string;
};

export function PageHeading({ title, lead }: Props) {
  return (
    <header className="page-heading">
      <h1>{title}</h1>
      {lead ? <p className="lead">{lead}</p> : null}
    </header>
  );
}
