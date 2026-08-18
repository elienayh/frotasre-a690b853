import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: UsuariosLayout,
});

function UsuariosLayout() {
  return <Outlet />;
}
