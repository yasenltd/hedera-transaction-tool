import type { Page, TestInfo } from '@playwright/test';

export function createLocalOnlyOrganizationServerUrl(
  testInfo: Pick<TestInfo, 'retry' | 'workerIndex'>,
) {
  return `http://local-organization-connection.test.invalid/${testInfo.workerIndex}-${testInfo.retry}-${Date.now()}`;
}

export async function createLocalOrganizationConnectionForTesting(
  page: Page,
  nickname: string,
  serverUrl: string,
) {
  await page.evaluate(
    async ({ nickname, serverUrl }) => {
      type LocalOrganization = {
        id: string;
        nickname: string;
        serverUrl: string;
        key: string;
      };

      type VueAppContainer = HTMLElement & {
        __vue_app__?: {
          config?: {
            globalProperties?: {
              $pinia?: {
                _s?: Map<
                  string,
                  {
                    organizations?: Array<
                      LocalOrganization & {
                        isLoading: boolean;
                        isServerActive: boolean;
                        loginRequired: boolean;
                      }
                    >;
                  }
                >;
              };
            };
          };
        };
      };

      type ElectronApiWindow = Window & {
        electronAPI: {
          local: {
            organizations: {
              addOrganization: (organization: {
                nickname: string;
                serverUrl: string;
                key: string;
              }) => Promise<LocalOrganization>;
            };
          };
        };
      };

      const electronWindow = window as unknown as ElectronApiWindow;
      const organization = await electronWindow.electronAPI.local.organizations.addOrganization({
        nickname,
        serverUrl,
        key: '',
      });

      const appRoot = document.querySelector('#app') as VueAppContainer | null;
      const userStore = appRoot?.__vue_app__?.config?.globalProperties?.$pinia?._s?.get('user');

      if (!userStore?.organizations) {
        throw new Error('Unable to access user store organizations');
      }

      userStore.organizations = [
        ...userStore.organizations,
        {
          ...organization,
          isLoading: false,
          isServerActive: false,
          loginRequired: false,
        },
      ];
    },
    { nickname, serverUrl },
  );
}

export async function deleteLocalOrganizationConnectionForTesting(page: Page, serverUrl: string) {
  await page.evaluate(async serverUrl => {
    type LocalOrganization = {
      id: string;
      serverUrl: string;
    };

    type VueAppContainer = HTMLElement & {
      __vue_app__?: {
        config?: {
          globalProperties?: {
            $pinia?: {
              _s?: Map<
                string,
                {
                  organizations?: LocalOrganization[];
                }
              >;
            };
          };
        };
      };
    };

    type ElectronApiWindow = Window & {
      electronAPI: {
        local: {
          organizations: {
            getOrganizations: () => Promise<LocalOrganization[]>;
            deleteOrganization: (id: string) => Promise<boolean>;
          };
        };
      };
    };

    const electronWindow = window as unknown as ElectronApiWindow;
    const organizations = await electronWindow.electronAPI.local.organizations.getOrganizations();

    for (const organization of organizations) {
      if (organization.serverUrl === serverUrl) {
        await electronWindow.electronAPI.local.organizations.deleteOrganization(organization.id);
      }
    }

    const appRoot = document.querySelector('#app') as VueAppContainer | null;
    const userStore = appRoot?.__vue_app__?.config?.globalProperties?.$pinia?._s?.get('user');
    if (userStore?.organizations) {
      userStore.organizations = userStore.organizations.filter(
        organization => organization.serverUrl !== serverUrl,
      );
    }
  }, serverUrl);
}
