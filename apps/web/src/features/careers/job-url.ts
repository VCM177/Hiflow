const UUID_AT_END =
  /(?:^|-)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** Lower-case ASCII words joined by dashes: "Lập trình viên Đồ họa" → "lap-trinh-vien-do-hoa". */
export function slugify(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

/** The canonical address segment of a job: `<slug>-<uuid>`, or just the id for an untitled slug. */
export function jobSlugId(job: { id: string; title: string }): string {
  const slug = slugify(job.title);
  return slug ? `${slug}-${job.id}` : job.id;
}

/** The job id at the end of a `<slug>-<uuid>` segment, or null when there is none. */
export function parseJobId(slugId: string): string | null {
  const match = UUID_AT_END.exec(slugId);
  return match ? match[1].toLowerCase() : null;
}

export function jobPath(job: { id: string; title: string }): string {
  return `/careers/${jobSlugId(job)}`;
}
