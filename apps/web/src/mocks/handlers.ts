import {
  createGetMe200,
  createPaginatedAuditLogs,
  createPaginatedRoles,
  createPaginatedSubscriptions,
  createPaginatedTodos,
  createPaginatedUploads,
  createPaginatedUsers,
  createRole,
  createSubscription,
  createTodo,
  createUpload,
  createUserWithRole,
  deleteRolesIdHandler,
  deleteRolesIdHandlerResponse204,
  deleteSubscriptionsIdHandler,
  deleteSubscriptionsIdHandlerResponse204,
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
  getMeEntitlementsHandler,
  getMeHandler,
  getMeHandlerResponse200,
  getMePermissionsHandler,
  getMeProvidersHandler,
  getMeProvidersHandlerResponse200,
  getMeSubscriptionHandler,
  getMeSubscriptionHandlerResponse204,
  getPermissionsResourcesHandler,
  getRegistrationStatusHandler,
  getRegistrationStatusHandlerResponse200,
  getRolesAllHandler,
  getRolesHandler,
  getRolesIdHandler,
  getRolesIdHandlerResponse404,
  getRolesIdPermissionsHandler,
  getSubscriptionsHandler,
  getSubscriptionsIdHandler,
  getSubscriptionsIdHandlerResponse404,
  getSubscriptionStatusHandler,
  getSubscriptionStatusHandlerResponse200,
  getTodosHandler,
  getTodosIdHandler,
  getTodosIdHandlerResponse404,
  getUploadsHandler,
  getUploadsIdHandler,
  getUploadsIdHandlerResponse404,
  getUsersAllHandler,
  getUsersHandler,
  getUsersIdHandler,
  getUsersIdHandlerResponse404,
  patchMeHandler,
  patchMeHandlerResponse200,
  patchMePasswordHandler,
  patchMePasswordHandlerResponse204,
  patchRolesIdHandler,
  patchRolesIdHandlerResponse404,
  patchSubscriptionsIdHandler,
  patchSubscriptionsIdHandlerResponse404,
  patchTodosIdHandler,
  patchTodosIdHandlerResponse404,
  patchUsersIdHandler,
  patchUsersIdHandlerResponse404,
  postBootstrapHandler,
  postMeSetPasswordHandler,
  postMeSetPasswordHandlerResponse204,
  postRolesHandler,
  postRolesHandlerResponse201,
  postSubscriptionsHandler,
  postSubscriptionsHandlerResponse201,
  postTodosHandler,
  postTodosHandlerResponse201,
  postUploadsHandler,
  postUploadsHandlerResponse201,
  postUsersHandler,
  postUsersHandlerResponse201,
  putRolesIdPermissionsHandler,
  putUsersIdPasswordHandler,
  putUsersIdPasswordHandlerResponse404,
} from '@helix/api-client/mocks'

export const handlers = [
  // Me (profile)
  getMeHandler(() => getMeHandlerResponse200(createGetMe200())),
  getMeProvidersHandler(() =>
    getMeProvidersHandlerResponse200({ providers: [] })
  ),
  patchMeHandler(() => patchMeHandlerResponse200(createGetMe200())),
  patchMePasswordHandler(() => patchMePasswordHandlerResponse204()),
  postMeSetPasswordHandler(() => postMeSetPasswordHandlerResponse204()),

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
  getUsersAllHandler([]),
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
    patchUsersIdHandlerResponse404({
      message: 'User not found',
      code: 'user_not_found',
    })
  ),
  deleteUsersIdHandler(() => deleteUsersIdHandlerResponse204()),
  putUsersIdPasswordHandler(() =>
    putUsersIdPasswordHandlerResponse404({
      message: 'User not found',
      code: 'user_not_found',
    })
  ),

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

  // Subscriptions
  getSubscriptionStatusHandler(() =>
    getSubscriptionStatusHandlerResponse200({
      enabled: false,
      plans: [],
    })
  ),
  getMeSubscriptionHandler(() => getMeSubscriptionHandlerResponse204()),
  getMeEntitlementsHandler({
    operator: false,
    subscribed: false,
    features: [],
    graceEndsAt: null,
  }),
  getSubscriptionsHandler(
    createPaginatedSubscriptions({
      data: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
    })
  ),
  getSubscriptionsIdHandler(() =>
    getSubscriptionsIdHandlerResponse404({ message: 'Not found' })
  ),
  postSubscriptionsHandler(() =>
    postSubscriptionsHandlerResponse201(createSubscription())
  ),
  patchSubscriptionsIdHandler(() =>
    patchSubscriptionsIdHandlerResponse404({ message: 'Not found' })
  ),
  deleteSubscriptionsIdHandler(() => deleteSubscriptionsIdHandlerResponse204()),

  // Bootstrap / Registration
  getBootstrapStatusHandler({ bootstrapped: true }),
  postBootstrapHandler(),
  getRegistrationStatusHandler(() =>
    getRegistrationStatusHandlerResponse200({ open: false, providers: [] })
  ),

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
