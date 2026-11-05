import { notFound } from 'next/navigation';

// Any signed-in address that no page claims lands here, so the "not found" page
// shows inside the shell with its menu. Real pages take precedence over this one.
export default function UnknownPage() {
  notFound();
}
