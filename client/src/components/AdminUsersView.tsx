import { useEffect } from 'preact/hooks';
import { currentLanguage, t } from '../state/language';
import { currentUser } from '../state/auth';
import {
  usersList,
  isUsersLoading,
  usersError,
  userSearchQuery,
  userRoleFilter,
  userStatusFilter,
  userTestFilter,
  filteredUsers,
  deactivatingUser,
  isDeactivatingUser,
  deactivateUserError,
  deletingUser,
  deletePhoneInput,
  isDeletingUser,
  deleteUserError,
  markingUserId,
  markingTestUser,
  markTestError,
  isCleanupModalOpen,
  cleanupPreview,
  isLoadingCleanupPreview,
  cleanupConfirmInput,
  isExecutingCleanup,
  cleanupError,
  fetchAdminUsers,
  toggleUserStatus,
  toggleUserTestMark,
  openMarkTestModal,
  closeMarkTestModal,
  confirmToggleUserTestMark,
  openDeactivateModal,
  closeDeactivateModal,
  confirmDeactivateUser,
  openDeleteModal,
  closeDeleteModal,
  confirmDeleteUser,
  openCleanupModal,
  closeCleanupModal,
  executeCleanup,
} from '../state/admin-users';
import {
  SearchIcon,
  RefreshIcon,
  SpinnerIcon,
  AlertCircleIcon,
  CheckIcon,
  TrashIcon,
  UsersIcon,
} from './icons';

export function AdminUsersView() {
  const loggedInUser = currentUser.value;
  const lang = currentLanguage.value || 'en';
  const users = filteredUsers.value;
  const loading = isUsersLoading.value;
  const error = usersError.value;

  useEffect(() => {
    fetchAdminUsers();
  }, []);

  return (
    <div class="space-y-6">
      {/* View Header & Action Controls */}
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-xl font-bold text-text-main flex items-center gap-2">
            <UsersIcon size={24} class="text-brand" />
            <span>{t('admin.users_title')}</span>
          </h2>
          <p class="text-sm text-text-sub mt-0.5">
            {t('admin.users_subtitle')}
          </p>
        </div>

        <div class="flex items-center gap-2">
          {/* Refresh Button */}
          <button
            onClick={() => fetchAdminUsers()}
            disabled={loading}
            class="min-h-[44px] px-3 py-2 bg-surface hover:bg-slate-50 border border-border rounded-lg text-sm font-medium text-text-main flex items-center gap-1.5 transition-colors"
            title={t('admin.refresh_action')}
          >
            <RefreshIcon size={16} class={loading ? 'animate-spin' : ''} />
            <span class="hidden sm:inline">{t('admin.refresh_action')}</span>
          </button>

          {/* Test Data Cleanup Button */}
          <button
            onClick={() => openCleanupModal()}
            class="min-h-[44px] px-3.5 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <TrashIcon size={16} class="text-amber-700" />
            <span>{t('admin.test_cleanup_section_title')}</span>
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div class="bg-surface border border-border rounded-lg p-4 shadow-xs space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Box */}
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-sub">
              <SearchIcon size={18} />
            </div>
            <input
              type="text"
              value={userSearchQuery.value}
              onInput={(e) => {
                userSearchQuery.value = (e.target as HTMLInputElement).value;
              }}
              placeholder={t('admin.users_search_placeholder')}
              class="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
            />
          </div>

          {/* Role Filter */}
          <div>
            <select
              value={userRoleFilter.value}
              onChange={(e) => {
                userRoleFilter.value = (e.target as HTMLSelectElement).value as any;
              }}
              class="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface text-text-main focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="all">{t('admin.filter_role_all')}</option>
              <option value="customer">{t('admin.filter_role_customer')}</option>
              <option value="provider">{t('admin.filter_role_provider')}</option>
              <option value="admin">{t('admin.filter_role_admin')}</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={userStatusFilter.value}
              onChange={(e) => {
                userStatusFilter.value = (e.target as HTMLSelectElement).value as any;
              }}
              class="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface text-text-main focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="all">{t('admin.filter_all')}</option>
              <option value="active">{t('admin.filter_active')}</option>
              <option value="inactive">{t('admin.filter_inactive')}</option>
            </select>
          </div>

          {/* Test Data Filter */}
          <div>
            <select
              value={userTestFilter.value}
              onChange={(e) => {
                userTestFilter.value = (e.target as HTMLSelectElement).value as any;
              }}
              class="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface text-text-main focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="all">{t('admin.filter_test_all')}</option>
              <option value="test">{t('admin.filter_test_only')}</option>
              <option value="real">{t('admin.filter_real_only')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content States */}
      {loading && usersList.value.length === 0 && (
        <div class="flex items-center justify-center py-16 bg-surface border border-border rounded-lg">
          <div class="flex flex-col items-center gap-3">
            <SpinnerIcon size={32} class="text-brand animate-spin" />
            <p class="text-sm text-text-sub">{t('admin.loading')}</p>
          </div>
        </div>
      )}

      {!loading && error && (
        <div class="p-6 bg-red-50 border border-red-200 rounded-lg text-center">
          <AlertCircleIcon size={32} class="text-danger mx-auto mb-2" />
          <h3 class="text-base font-bold text-danger mb-1">
            {t('admin.load_users_error')}
          </h3>
          <button
            onClick={() => fetchAdminUsers()}
            class="mt-3 px-4 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand-dark"
          >
            {t('admin.retry')}
          </button>
        </div>
      )}

      {!loading && !error && users.length === 0 && (
        <div class="p-12 bg-surface border border-border rounded-lg text-center">
          <UsersIcon size={40} class="text-text-sub/50 mx-auto mb-3" />
          <h3 class="text-base font-bold text-text-main mb-1">
            {t('admin.no_users_found')}
          </h3>
          <p class="text-sm text-text-sub max-w-md mx-auto mb-4">
            {t('admin.no_users_match')}
          </p>
          <button
            onClick={() => {
              userSearchQuery.value = '';
              userRoleFilter.value = 'all';
              userStatusFilter.value = 'all';
              userTestFilter.value = 'all';
            }}
            class="px-4 py-2 border border-border rounded-lg text-sm font-semibold text-brand hover:bg-slate-50"
          >
            {t('admin.clear_filters')}
          </button>
        </div>
      )}

      {/* Users List Table */}
      {!error && users.length > 0 && (
        <div class="bg-surface border border-border rounded-lg overflow-hidden shadow-xs">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm border-collapse">
              <thead>
                <tr class="bg-slate-50 border-b border-border text-xs font-semibold text-text-sub uppercase tracking-wider">
                  <th class="px-4 py-3">{t('admin.col_user')}</th>
                  <th class="px-4 py-3">{t('admin.col_role')}</th>
                  <th class="px-4 py-3">{t('admin.col_status')}</th>
                  <th class="px-4 py-3">{t('admin.col_is_test')}</th>
                  <th class="px-4 py-3">{t('admin.col_bookings_count')}</th>
                  <th class="px-4 py-3 text-right">{t('admin.col_actions')}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                {users.map((user) => {
                  const isCurrentAdmin = loggedInUser?.id === user.id;
                  const isMarking = markingUserId.value === user.id;

                  return (
                    <tr key={user.id} class="hover:bg-slate-50/70 transition-colors">
                      {/* User Info */}
                      <td class="px-4 py-3">
                        <div class="font-semibold text-text-main">
                          {user.fullName || (user.role === 'admin' ? t('admin.role_admin') : '—')}
                        </div>
                        <div class="text-xs text-text-sub font-mono">{user.phone}</div>
                        <div class="text-[11px] text-text-sub/80 mt-0.5">
                          {new Date(user.createdAt).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </td>

                      {/* Role */}
                      <td class="px-4 py-3">
                        <div class="flex flex-col items-start gap-1">
                          <span
                            class={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                              user.role === 'admin'
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : user.role === 'provider'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {user.role === 'admin'
                              ? t('admin.role_admin')
                              : user.role === 'provider'
                              ? t('admin.role_provider')
                              : t('admin.role_customer')}
                          </span>
                          {user.role === 'provider' && user.categoryTitleEn && (
                            <span class="text-xs text-text-sub">
                              {lang === 'hi' ? user.categoryTitleHi : user.categoryTitleEn}
                            </span>
                          )}
                          {user.role === 'provider' && user.workerVerificationStatus === 'VERIFIED' && (
                            <span class="text-[11px] font-semibold text-emerald-700">
                              {t('worker.verified_tick')}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td class="px-4 py-3">
                        <span
                          class={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            user.isActive
                              ? 'bg-green-50 text-action border border-green-200'
                              : 'bg-red-50 text-danger border border-red-200'
                          }`}
                        >
                          <span
                            class={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-action' : 'bg-danger'}`}
                          ></span>
                          <span>{user.isActive ? t('admin.status_active') : t('admin.status_inactive')}</span>
                        </span>
                      </td>

                      {/* Data Type (is_test) */}
                      <td class="px-4 py-3">
                        <span
                          class={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            user.isTest
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {user.isTest ? t('admin.badge_test') : t('admin.badge_real')}
                        </span>
                      </td>

                      {/* Bookings Count */}
                      <td class="px-4 py-3">
                        <div class="text-xs">
                          <span class="font-semibold text-text-main">
                            {t('admin.bookings_total_label').replace('{count}', String(user.bookingCounts.total))}
                          </span>
                          {user.bookingCounts.total > 0 && (
                            <div class="flex flex-wrap gap-1 mt-0.5 text-[11px] text-text-sub">
                              {user.bookingCounts.active > 0 && (
                                <span class="text-amber-700 font-medium">
                                  {t('admin.bookings_active_label').replace('{count}', String(user.bookingCounts.active))}
                                </span>
                              )}
                              {user.bookingCounts.completed > 0 && (
                                <span class="text-emerald-700 font-medium">
                                  {t('admin.bookings_completed_label').replace('{count}', String(user.bookingCounts.completed))}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td class="px-4 py-3 text-right">
                        <div class="flex items-center justify-end gap-1.5">
                          {/* Test Flag Toggle */}
                          <button
                            onClick={() => openMarkTestModal(user)}
                            disabled={isMarking || user.role === 'admin'}
                            class={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                              user.role === 'admin'
                                ? 'opacity-40 cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200'
                                : user.isTest
                                ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                            }`}
                            title={
                              user.role === 'admin'
                                ? t('admin.cannot_mark_admin_as_test')
                                : user.isTest
                                ? t('admin.mark_as_real')
                                : t('admin.mark_as_test')
                            }
                          >
                            {isMarking
                              ? t('admin.marking_test')
                              : user.isTest
                              ? t('admin.mark_as_real')
                              : t('admin.mark_as_test')}
                          </button>

                          {/* Status Toggle (Deactivate / Activate) */}
                          {user.isActive ? (
                            <button
                              onClick={() => openDeactivateModal(user)}
                              disabled={isCurrentAdmin}
                              class="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-danger bg-red-50 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              title={isCurrentAdmin ? t('admin.cannot_deactivate_self') : t('admin.deactivate')}
                            >
                              {t('admin.deactivate')}
                            </button>
                          ) : (
                            <button
                              onClick={() => toggleUserStatus(user, true)}
                              class="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-green-200 text-action bg-green-50 hover:bg-green-100 transition-colors"
                            >
                              {t('admin.activate')}
                            </button>
                          )}

                          {/* Delete Button */}
                          <button
                            onClick={() => openDeleteModal(user)}
                            disabled={isCurrentAdmin}
                            class="p-1.5 text-text-sub hover:text-danger hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            title={isCurrentAdmin ? t('admin.cannot_delete_self') : t('admin.delete_user_btn')}
                            aria-label={t('admin.delete_user_btn')}
                          >
                            <TrashIcon size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: Deactivate User Modal */}
      {deactivatingUser.value && (
        <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div class="bg-surface border border-border rounded-xl max-w-md w-full p-6 shadow-xl">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-full bg-red-100 text-danger flex items-center justify-center shrink-0">
                <AlertCircleIcon size={22} />
              </div>
              <div class="flex-1">
                <h3 class="text-base font-bold text-text-main">
                  {t('admin.deactivate_user_modal_title')}
                </h3>
                <p class="text-sm text-text-sub mt-2">
                  {t('admin.deactivate_user_desc').replace(
                    '{name}',
                    deactivatingUser.value.fullName || deactivatingUser.value.phone
                  )}
                </p>

                {deactivateUserError.value && (
                  <p class="mt-3 text-xs font-medium text-danger">
                    {deactivateUserError.value}
                  </p>
                )}

                <div class="mt-6 flex items-center justify-end gap-3">
                  <button
                    onClick={() => closeDeactivateModal()}
                    class="px-4 py-2 border border-border rounded-lg text-sm font-semibold text-text-sub hover:bg-slate-50"
                  >
                    {t('admin.cancel')}
                  </button>
                  <button
                    onClick={() => confirmDeactivateUser()}
                    disabled={isDeactivatingUser.value}
                    class="px-4 py-2 bg-danger text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                  >
                    {isDeactivatingUser.value ? t('admin.saving') : t('admin.confirm_deactivate_btn')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Permanent User Deletion Modal (Requires Phone Re-entry) */}
      {deletingUser.value && (
        <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div class="bg-surface border border-border rounded-xl max-w-md w-full p-6 shadow-xl">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-full bg-red-100 text-danger flex items-center justify-center shrink-0">
                <TrashIcon size={22} />
              </div>
              <div class="flex-1">
                <h3 class="text-base font-bold text-text-main">
                  {t('admin.delete_user_modal_title')}
                </h3>
                <div class="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 leading-relaxed">
                  {t('admin.delete_user_warning')}
                </div>

                <div class="mt-4">
                  <label class="block text-xs font-semibold text-text-main mb-1.5">
                    {t('admin.delete_phone_confirm_label').replace(
                      '{phone}',
                      deletingUser.value.phone
                    )}
                  </label>
                  <input
                    type="text"
                    value={deletePhoneInput.value}
                    onInput={(e) => {
                      deletePhoneInput.value = (e.target as HTMLInputElement).value;
                    }}
                    placeholder={deletingUser.value.phone}
                    class="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-danger"
                  />
                </div>

                {deleteUserError.value && (
                  <p class="mt-3 text-xs font-medium text-danger">
                    {deleteUserError.value === 'PHONE_MISMATCH'
                      ? t('admin.delete_phone_mismatch')
                      : deleteUserError.value}
                  </p>
                )}

                <div class="mt-6 flex items-center justify-end gap-3">
                  <button
                    onClick={() => closeDeleteModal()}
                    class="px-4 py-2 border border-border rounded-lg text-sm font-semibold text-text-sub hover:bg-slate-50"
                  >
                    {t('admin.cancel')}
                  </button>
                  <button
                    onClick={() => confirmDeleteUser()}
                    disabled={
                      isDeletingUser.value ||
                      deletePhoneInput.value.trim() !== deletingUser.value.phone
                    }
                    class="px-4 py-2 bg-danger text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {isDeletingUser.value && <SpinnerIcon size={14} class="animate-spin" />}
                    <span>
                      {isDeletingUser.value
                        ? t('admin.deleting_user')
                        : t('admin.confirm_delete_btn')}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Safe Test Data Cleanup Modal */}
      {isCleanupModalOpen.value && (
        <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div class="bg-surface border border-border rounded-xl max-w-lg w-full p-6 shadow-xl">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <TrashIcon size={22} />
              </div>
              <div class="flex-1">
                <h3 class="text-base font-bold text-text-main">
                  {t('admin.cleanup_modal_title')}
                </h3>
                <p class="text-xs text-text-sub mt-1">
                  {t('admin.cleanup_modal_desc')}
                </p>

                {/* Preview Loading */}
                {isLoadingCleanupPreview.value && (
                  <div class="my-6 flex items-center justify-center gap-2 text-sm text-text-sub">
                    <SpinnerIcon size={20} class="animate-spin text-brand" />
                    <span>{t('admin.loading')}</span>
                  </div>
                )}

                {/* Preview Content */}
                {!isLoadingCleanupPreview.value && cleanupPreview.value && (
                  <div class="my-4 space-y-2">
                    <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-1.5 text-amber-900">
                      <div class="font-semibold text-sm text-amber-950 mb-1">
                        {t('admin.preview_cleanup_btn')}:
                      </div>
                      <div>
                        {t('admin.cleanup_test_users_count')
                          .replace('{count}', String(cleanupPreview.value.testUsersCount))
                          .replace('{customers}', String(cleanupPreview.value.testCustomersCount))
                          .replace('{providers}', String(cleanupPreview.value.testProvidersCount))}
                      </div>
                      <div>
                        {t('admin.cleanup_test_bookings_count').replace(
                          '{count}',
                          String(cleanupPreview.value.testBookingsCount)
                        )}
                      </div>
                      <div>
                        {t('admin.cleanup_test_logs_count').replace(
                          '{count}',
                          String(cleanupPreview.value.testStatusLogsCount)
                        )}
                      </div>
                    </div>

                    {!cleanupPreview.value.canCleanup && (
                      <div class="p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-action font-medium">
                        {t('admin.no_test_data_to_clean')}
                      </div>
                    )}

                    {cleanupPreview.value.canCleanup && (
                      <div class="mt-4">
                        <label class="block text-xs font-semibold text-text-main mb-1.5">
                          {t('admin.cleanup_confirm_instruction')}
                        </label>
                        <input
                          type="text"
                          value={cleanupConfirmInput.value}
                          onInput={(e) => {
                            cleanupConfirmInput.value = (e.target as HTMLInputElement).value;
                          }}
                          placeholder={t('admin.cleanup_confirm_placeholder')}
                          class="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    )}
                  </div>
                )}

                {cleanupError.value && (
                  <p class="mt-2 text-xs font-medium text-danger">
                    {cleanupError.value}
                  </p>
                )}

                <div class="mt-6 flex items-center justify-end gap-3">
                  <button
                    onClick={() => closeCleanupModal()}
                    class="px-4 py-2 border border-border rounded-lg text-sm font-semibold text-text-sub hover:bg-slate-50"
                  >
                    {t('admin.cancel')}
                  </button>
                  {cleanupPreview.value?.canCleanup && (
                    <button
                      onClick={() => executeCleanup()}
                      disabled={
                        isExecutingCleanup.value ||
                        cleanupConfirmInput.value.trim() !== 'CLEANUP'
                      }
                      class="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {isExecutingCleanup.value && <SpinnerIcon size={14} class="animate-spin" />}
                      <span>
                        {isExecutingCleanup.value
                          ? t('admin.cleaning_up')
                          : t('admin.cleanup_confirm_btn')}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Mark Test Data Status Confirmation Modal */}
      {markingTestUser.value && (
        <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div class="bg-surface border border-border rounded-xl max-w-md w-full p-6 shadow-xl">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <AlertCircleIcon size={22} />
              </div>
              <div class="flex-1">
                <h3 class="text-base font-bold text-text-main">
                  {t('admin.mark_test_modal_title')}
                </h3>
                <p class="text-sm text-text-sub mt-2">
                  {markingTestUser.value.isTest
                    ? t('admin.mark_real_confirm_desc').replace('{name}', markingTestUser.value.fullName || markingTestUser.value.phone)
                    : t('admin.mark_test_confirm_desc').replace('{name}', markingTestUser.value.fullName || markingTestUser.value.phone)}
                </p>

                {markTestError.value && (
                  <p class="mt-2 text-xs font-medium text-danger">
                    {markTestError.value}
                  </p>
                )}

                <div class="mt-6 flex items-center justify-end gap-3">
                  <button
                    onClick={() => closeMarkTestModal()}
                    class="px-4 py-2 border border-border rounded-lg text-sm font-semibold text-text-sub hover:bg-slate-50"
                  >
                    {t('admin.cancel')}
                  </button>
                  <button
                    onClick={() => confirmToggleUserTestMark()}
                    disabled={markingUserId.value !== null}
                    class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                  >
                    {markingUserId.value !== null && <SpinnerIcon size={16} class="animate-spin" />}
                    <span>{t('admin.confirm')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
