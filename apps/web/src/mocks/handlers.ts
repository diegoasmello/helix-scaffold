import {
  createGetMe200,
  createPaginatedAuditLogs,
  createPaginatedRoles,
  createPaginatedTodos,
  createPaginatedUploads,
  createPaginatedUsers,
  createRole,
  createTodo,
  createUpload,
  createUserWithRole,
  deleteRolesIdHandler,
  deleteRolesIdHandlerResponse204,
  deleteTodosIdHandler,
  deleteTodosIdHandlerResponse204,
  deleteUploadsIdHandler,
  deleteUploadsIdHandlerResponse204,
  deleteUsersIdHandler,
  deleteUsersIdHandlerResponse204,
  getAuditLogsHandler,
  getAuditLogsIdHandler,
  getAuditLogsIdHandlerResponse404,
  getBootstrapStatusHandler,
  getMeHandler,
  getMeHandlerResponse200,
  getMePermissionsHandler,
  getPermissionsResourcesHandler,
  getRolesAllHandler,
  getRolesHandler,
  getRolesIdHandler,
  getRolesIdHandlerResponse404,
  getRolesIdPermissionsHandler,
  getTodosHandler,
  getTodosIdHandler,
  getTodosIdHandlerResponse404,
  getUploadsHandler,
  getUploadsIdHandler,
  getUploadsIdHandlerResponse404,
  getUsersHandler,
  getUsersIdHandler,
  getUsersIdHandlerResponse404,
  patchMeHandler,
  patchMeHandlerResponse200,
  patchMePasswordHandler,
  patchMePasswordHandlerResponse204,
  patchRolesIdHandler,
  patchRolesIdHandlerResponse404,
  patchTodosIdHandler,
  patchTodosIdHandlerResponse404,
  patchUsersIdHandler,
  patchUsersIdHandlerResponse404,
  postBootstrapHandler,
  postRolesHandler,
  postRolesHandlerResponse201,
  postTodosHandler,
  postTodosHandlerResponse201,
  postUploadsHandler,
  postUploadsHandlerResponse201,
  postUsersHandler,
  postUsersHandlerResponse201,
  putRolesIdPermissionsHandler,
} from '@helix/api-client/mocks'

export const handlers = [
  // Me (profile)
  getMeHandler(() => getMeHandlerResponse200(createGetMe200())),
  patchMeHandler(() => patchMeHandlerResponse200(createGetMe200())),
  patchMePasswordHandler(() => patchMePasswordHandlerResponse204()),

  // Todos
  getTodosHandler(
    createPaginatedTodos({
      data: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
    })
  ),
  getTodosIdHandler(() =>
    getTodosIdHandlerResponse404({ message: 'Not found' })
  ),
  postTodosHandler(() => postTodosHandlerResponse201(createTodo())),
  patchTodosIdHandler(() =>
    patchTodosIdHandlerResponse404({ message: 'Not found' })
  ),
  deleteTodosIdHandler(() => deleteTodosIdHandlerResponse204()),

  // Roles
  getRolesHandler(
    createPaginatedRoles({
      data: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
    })
  ),
  getRolesAllHandler([]),
  getRolesIdHandler(() =>
    getRolesIdHandlerResponse404({ message: 'Not found' })
  ),
  postRolesHandler(() => postRolesHandlerResponse201(createRole())),
  patchRolesIdHandler(() =>
    patchRolesIdHandlerResponse404({ message: 'Not found' })
  ),
  deleteRolesIdHandler(() => deleteRolesIdHandlerResponse204()),

  // Users
  getUsersHandler(
    createPaginatedUsers({
      data: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
    })
  ),
  getUsersIdHandler(() =>
    getUsersIdHandlerResponse404({ message: 'Not found' })
  ),
  postUsersHandler(() => postUsersHandlerResponse201(createUserWithRole())),
  patchUsersIdHandler(() =>
    patchUsersIdHandlerResponse404({ message: 'Not found' })
  ),
  deleteUsersIdHandler(() => deleteUsersIdHandlerResponse204()),

  // Permissions / Roles permissions
  getPermissionsResourcesHandler([]),
  getMePermissionsHandler({ grants: {} }),
  getRolesIdPermissionsHandler({ grants: {} }),
  putRolesIdPermissionsHandler({ grants: {} }),

  // Uploads
  getUploadsHandler(
    createPaginatedUploads({
      data: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
    })
  ),
  getUploadsIdHandler(() =>
    getUploadsIdHandlerResponse404({ message: 'Not found' })
  ),
  postUploadsHandler(() => postUploadsHandlerResponse201(createUpload())),
  deleteUploadsIdHandler(() => deleteUploadsIdHandlerResponse204()),

  // Bootstrap
  getBootstrapStatusHandler({ bootstrapped: true }),
  postBootstrapHandler(),

  // Audit logs
  getAuditLogsHandler(
    createPaginatedAuditLogs({
      data: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
    })
  ),
  getAuditLogsIdHandler(() =>
    getAuditLogsIdHandlerResponse404({ message: 'Not found' })
  ),
]
