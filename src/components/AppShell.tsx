import {
  useMemo,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";


import { useLocation } from "react-router-dom";

import {
  AppShell,
  Divider,
  NavLink,
  Box,
  UnstyledButton,
  ActionIcon,
  Tooltip,
} from "@mantine/core";

import { useMediaQuery } from "@mantine/hooks";

import {
  ClipboardCheck,
  ClipboardList,
  Code,
  Contact,
  Map,
  MapPinned,
  Menu,
  Search,
  Settings,
  Users,
} from "lucide-react";

import { AG_GRID_MOBILE_MQ } from "../agGridDefaults";

import { useCompactMobileTaskUi } from "../auth/nativeAuthKind";

import { useCurrentUser } from "../context/CurrentUserContext";

import { useOrgSettings } from "../context/OrgSettingsContext";

import { hasPermission, PERMISSIONS } from "../../shared/permissions.js";

import { resolveTaskListTypeFilters } from "../../shared/resolveTaskListTypeFilters.js";

import { taskListPageLabels } from "../../shared/taskListPageLabels.js";

import { useTaskListTypeFilters } from "../taskListTypeFilters";

import { FieldRouterNavLink, isNavActive } from "./FieldRouterNavLink";

import { MobilePersistentOutlet } from "./MobilePersistentOutlet";

import { ProductLinks } from "./ProductLinks";

import { CompactNavFieldMenuMark } from "./CompactNavFieldMenuMark";

import { deleteTask, restoreTask, updateTask } from "../api/tasks";

import { uploadAttachment } from "../api/attachments";

import type { TaskDetail } from "../types/task";

import { NewTaskModal, type NewTaskFormValues } from "./NewTaskModal";

import { TaskDetailModal } from "./TaskDetailModal";

import { TaskSearchInput } from "./TaskSearchInput";

import {
  buildUpdateTaskInput,
  taskDetailToFormValues,
} from "../taskDetailForm";

import { orgLogoSrc } from "../orgLogoSrc";

import {
  COMPACT_NAV_DRAWER_PX,
  COMPACT_NAV_RAIL_PX,
	COMPACT_NAV_WIDE_MQ,
	initialCompactNavOpen,
	matchesCompactNavWideMq,
	writeCompactNavOpen,
} from "../shellCompactNav";

import { buildMobileBottomNavItems } from "../mobileBottomNavItems";

import { useMobileBottomNavPins } from "../mobileBottomNavPrefs";

const navLinkStyles = {
  root: {
    borderRadius: "var(--mantine-radius-md)",

    color: "var(--color-text-on-dark-muted)",
  },

  label: { fontWeight: 500 },
} as const;

export function FieldAppShell() {
  const location = useLocation();

  const { user } = useCurrentUser();

  const { settings: orgSettings } = useOrgSettings();

  const showUsersNav = hasPermission(
    user?.permissions,
    PERMISSIONS.manageUsers,
  );

  const showManagementNav = hasPermission(
    user?.permissions,

    PERMISSIONS.manageOrg,
  );

  const showCrewMapNav = hasPermission(
    user?.permissions,

    PERMISSIONS.viewCrewMap,
  );

  const showAllTasksNav = hasPermission(
    user?.permissions,

    PERMISSIONS.viewAllTasks,
  );

  const isMobile = useMediaQuery(AG_GRID_MOBILE_MQ, true, {
    getInitialValueInEffect: false,
  });

  const compactUi = useCompactMobileTaskUi();

  const isWideDesktop = useMediaQuery(COMPACT_NAV_WIDE_MQ, matchesCompactNavWideMq(), {
    getInitialValueInEffect: false,
  });

  const [menuOpen, setMenuOpen] = useState(initialCompactNavOpen);

  const [focusSearchOnOpen, setFocusSearchOnOpen] = useState(false);

  const navPush = menuOpen && isWideDesktop;

  const orgSrc = orgLogoSrc(orgSettings.logoUrl);

  const setNavOpen = useCallback((open: boolean) => {
    setMenuOpen(open);

    writeCompactNavOpen(open);
  }, []);

  const toggleNav = useCallback(() => {
    setMenuOpen((prev) => {
      const next = !prev;

      writeCompactNavOpen(next);

      return next;
    });
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      setFocusSearchOnOpen(false);

      return;
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNavOpen(false);
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen, setNavOpen]);

  const [searchTaskId, setSearchTaskId] = useState<number | null>(null);

  const [editingTask, setEditingTask] = useState<TaskDetail | null>(null);

  const editorInitialValues = useMemo<NewTaskFormValues | null>(
    () => (editingTask ? taskDetailToFormValues(editingTask) : null),

    [editingTask],
  );

  const editorInitialContactOptions = useMemo(() => {
    if (!editingTask) return null;

    return editingTask.contacts.map((c) => {
      const name = c.name.trim();

      return {
        value: String(c.id),

        label: c.email ? `${name} (${c.email})` : name,
      };
    });
  }, [editingTask]);

  const handleEditSearchTask = useCallback((task: TaskDetail) => {
    setSearchTaskId(null);

    setEditingTask(task);
  }, []);

  const handleDeleteSearchTask = useCallback(async (task: TaskDetail) => {
    await deleteTask(task.id);

    setSearchTaskId(null);
  }, []);

  const handleRestoreSearchTask = useCallback(async (task: TaskDetail) => {
    await restoreTask(task.id);

    setSearchTaskId(null);
  }, []);

  const handleSaveSearchTask = useCallback(
    async (
      values: NewTaskFormValues,

      _addAnother: boolean,

      pendingFiles: File[],

      customFieldPatch?: {
        touchedCustomFieldSlots: number[];

        clearedCustomFieldSlots: number[];

        customFields: Record<string, import("../types/task").CustomFieldValue>;
      },
    ) => {
      if (!editingTask) return;
      if (!user) {
        throw new Error(
          "Select a user in the sidebar before saving a task",
        );
      }

      const taskId = editingTask.id;

      await updateTask(taskId, {
        ...buildUpdateTaskInput(values, customFieldPatch),
        createdByUserId: user.id,
      });

      if (pendingFiles.length > 0) {
        if (!user) {
          throw new Error(
            "Select a user in the sidebar before uploading attachments",
          );
        }

        for (const file of pendingFiles) {
          await uploadAttachment(taskId, file, user.id);
        }
      }

      setSearchTaskId(taskId);
    },

    [editingTask, user],
  );

  const handleCloseSearchEditor = useCallback(() => {
    setEditingTask(null);
  }, []);

  const [userTypeFilters] = useTaskListTypeFilters();

  const enabledTaskTypeNames = useMemo(
    () =>
      orgSettings.taskTypes

        .filter((type) => type.enabled)

        .map((type) => type.name),

    [orgSettings.taskTypes],
  );

  const pageLabels = useMemo(() => {
    const activeFilters = resolveTaskListTypeFilters({
      userFilters: userTypeFilters,

      enabledTypeNames: enabledTaskTypeNames,
    });

    return taskListPageLabels(activeFilters, orgSettings.taskTypes);
  }, [orgSettings.taskTypes, userTypeFilters, enabledTaskTypeNames]);

  const [mobileNavPins] = useMobileBottomNavPins();

  const bottomNavItems = useMemo(() => {
    const routes = buildMobileBottomNavItems({
      pageLabels,
      showAllTasksNav,
      pins: mobileNavPins,
    });

    const iconForRoute = (to: string) => {
      switch (to) {
        case "/my-tasks":
          return ClipboardCheck;
        case "/tasks":
          return ClipboardList;
        case "/contacts":
          return Contact;
        case "/addresses":
          return MapPinned;
        case "/more":
          return Menu;
        default:
          return Menu;
      }
    };

    return routes.map((item) => ({
      ...item,
      icon: iconForRoute(item.to),
    }));
  }, [pageLabels, showAllTasksNav, mobileNavPins]);

  const wrapCollapsedNav = useCallback(
    (label: string, node: ReactNode) => {
      if (menuOpen) return node;

      return (
        <Tooltip label={label} position="right">
          <div>{node}</div>
        </Tooltip>
      );
    },

    [menuOpen],
  );

  const onNavRouteClick = useCallback(() => {
    if (!isWideDesktop) setNavOpen(false);
  }, [isWideDesktop, setNavOpen]);

  const settingsNavLink = (
    <NavLink
      component={FieldRouterNavLink}

      to="/settings"

      label="Settings"

      leftSection={<Settings size={18} />}

      active={location.pathname === "/settings"}

      color="brand"

      styles={navLinkStyles}

      className="field-nav-link"

      mt={menuOpen ? 4 : 0}

      onClick={onNavRouteClick}
    />
  );

  return (
    <AppShell
      padding="md"

      layout="alt"

      footer={{ height: 64 }}

      navbar={{
        width: navPush ? COMPACT_NAV_DRAWER_PX : COMPACT_NAV_RAIL_PX,

        breakpoint: "sm",

        collapsed: { mobile: true },
      }}

      className="field-app-shell field-compact-nav"

      data-nav-open={menuOpen || undefined}

      data-nav-push={navPush || undefined}

      styles={{
        navbar: {
          background: "var(--color-sidebar)",

          borderRight: "none",

          zIndex: 202,
        },

        footer: {
          background: "var(--color-sidebar)",

          borderTop: "none",

          zIndex: 201,
        },

        main: {
          background: "transparent",
        },
      }}
    >
      <AppShell.Navbar
        visibleFrom="sm"
        className="field-compact-nav-navbar"
        data-open={menuOpen || undefined}
        data-high-contrast={
          menuOpen && orgSettings.logoHighContrast ? true : undefined
        }
      >
        <div className="field-compact-nav-brand">
          <Tooltip
            label={menuOpen ? "Close menu" : "Open menu"}

            position="right"

            disabled={menuOpen}
          >
            <UnstyledButton
              className="field-compact-nav-menu-btn"

              aria-label={menuOpen ? "Close menu" : "Open menu"}

              aria-expanded={menuOpen}

              onClick={toggleNav}
            >
              <CompactNavFieldMenuMark />
            </UnstyledButton>
          </Tooltip>

          {orgSrc ? (
            <img
              src={orgSrc}

              alt=""

              draggable={false}

              className="field-compact-nav-org-logo"
            />
          ) : null}
        </div>

        <div className="field-compact-nav-search-slot">
          {menuOpen ? (
            <TaskSearchInput
              variant="sidebar"

              autoFocus={focusSearchOnOpen}

              onFound={(id) => {
                setSearchTaskId(id);

                if (!isWideDesktop) setNavOpen(false);
              }}
            />
          ) : (
            <Tooltip label="Find task" position="right">
              <ActionIcon
                variant="subtle"

                className="field-nav-icon-btn"

                aria-label="Find task"

                onClick={() => {
                  setFocusSearchOnOpen(true);

                  setNavOpen(true);
                }}
              >
                <Search size={18} aria-hidden />
              </ActionIcon>
            </Tooltip>
          )}
        </div>

        <Divider className="field-nav-divider" mt="sm" mb="sm" />

        <div className="field-compact-nav-links">
          {wrapCollapsedNav(
            pageLabels.mine,

            <NavLink
              component={FieldRouterNavLink}

              to="/my-tasks"

              label={pageLabels.mine}

              leftSection={<ClipboardCheck size={18} />}

              active={location.pathname === "/my-tasks"}

              color="brand"

              styles={navLinkStyles}

              className="field-nav-link"

              onClick={onNavRouteClick}
            />,
          )}

          {showAllTasksNav
            ? wrapCollapsedNav(
                pageLabels.all,

                <NavLink
                  component={FieldRouterNavLink}

                  to="/tasks"

                  label={pageLabels.all}

                  leftSection={<ClipboardList size={18} />}

                  active={location.pathname === "/tasks"}

                  color="brand"

                  styles={navLinkStyles}

                  className="field-nav-link"

                  onClick={onNavRouteClick}
                />,
              )
            : null}

          {wrapCollapsedNav(
            "Contacts",

            <NavLink
              component={FieldRouterNavLink}

              to="/contacts"

              label="Contacts"

              leftSection={<Contact size={18} />}

              active={location.pathname === "/contacts"}

              color="brand"

              styles={navLinkStyles}

              className="field-nav-link"

              onClick={onNavRouteClick}
            />,
          )}

          {wrapCollapsedNav(
            "Addresses",

            <NavLink
              component={FieldRouterNavLink}

              to="/addresses"

              label="Addresses"

              leftSection={<MapPinned size={18} />}

              active={location.pathname === "/addresses"}

              color="brand"

              styles={navLinkStyles}

              className="field-nav-link"

              onClick={onNavRouteClick}
            />,
          )}

          {showUsersNav
            ? wrapCollapsedNav(
                "Users",

                <NavLink
                  component={FieldRouterNavLink}

                  to="/users"

                  label="Users"

                  leftSection={<Users size={18} />}

                  active={location.pathname === "/users"}

                  color="brand"

                  styles={navLinkStyles}

                  className="field-nav-link"

                  onClick={onNavRouteClick}
                />,
              )
            : null}

          {showManagementNav
            ? wrapCollapsedNav(
                "Management",

                <NavLink
                  component={FieldRouterNavLink}

                  to="/management"

                  label="Management"

                  leftSection={<Settings size={18} />}

                  active={location.pathname === "/management"}

                  color="brand"

                  styles={navLinkStyles}

                  className="field-nav-link"

                  onClick={onNavRouteClick}
                />,
              )
            : null}

          {showCrewMapNav
            ? wrapCollapsedNav(
                "Crew map",

                <NavLink
                  component={FieldRouterNavLink}

                  to="/crew-map"

                  label="Crew map"

                  leftSection={<Map size={18} />}

                  active={location.pathname === "/crew-map"}

                  color="brand"

                  styles={navLinkStyles}

                  className="field-nav-link"

                  onClick={onNavRouteClick}
                />,
              )
            : null}

          {import.meta.env.DEV
            ? wrapCollapsedNav(
                "Development",

                <NavLink
                  component={FieldRouterNavLink}

                  to="/development"

                  label="Development"

                  leftSection={<Code size={18} />}

                  active={location.pathname.startsWith("/development")}

                  color="brand"

                  styles={navLinkStyles}

                  className="field-nav-link"

                  onClick={onNavRouteClick}
                />,
              )
            : null}
        </div>

        <Box className="field-compact-nav-footer" mt="md">
          <Divider className="field-nav-divider" mb="sm" />

          {menuOpen ? (
            <ProductLinks
              variant="sidebar"

              permissions={user?.permissions}
            />
          ) : null}

          {menuOpen
            ? settingsNavLink
            : wrapCollapsedNav("Settings", settingsNavLink)}
        </Box>
      </AppShell.Navbar>

      <AppShell.Footer hiddenFrom="sm" className="field-bottom-nav">
        <nav className="field-bottom-nav-inner" aria-label="Main">
          {bottomNavItems.map(({ to, end, label, icon: Icon }) => {
            const active = isNavActive(location.pathname, to, end);

            return (
              <UnstyledButton
                key={to}

                component={FieldRouterNavLink}

                to={to}

                end={end}

                className="field-bottom-nav-item"

                data-active={active || undefined}

                aria-current={active ? "page" : undefined}
              >
                <Icon size={22} strokeWidth={active ? 2.25 : 2} aria-hidden />

                <span>{label}</span>
              </UnstyledButton>
            );
          })}
        </nav>
      </AppShell.Footer>

      <AppShell.Main>
        {menuOpen && !navPush ? (
          <button
            type="button"

            className="field-compact-nav-overlay"

            aria-label="Close menu"

            onClick={() => setNavOpen(false)}
          />
        ) : null}

        <Box className="field-main-content">
          <MobilePersistentOutlet />
        </Box>
      </AppShell.Main>

      <NewTaskModal
        opened={editingTask != null}

        onClose={handleCloseSearchEditor}

        initialValues={editorInitialValues}

        customFieldDefsSnapshot={editingTask?.customFieldDefsSnapshot ?? null}

        initialContactOptions={editorInitialContactOptions}

        taskId={editingTask?.id ?? null}

        onSave={handleSaveSearchTask}
      />

      <TaskDetailModal
        taskId={searchTaskId}

        opened={!compactUi && searchTaskId != null}

        onClose={() => setSearchTaskId(null)}

        onEdit={handleEditSearchTask}

        onDelete={handleDeleteSearchTask}

        onRestore={handleRestoreSearchTask}

        onCloned={(newTaskId) => setSearchTaskId(newTaskId)}
      />
    </AppShell>
  );
}
