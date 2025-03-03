import { KubeObject } from '@kinvolk/headlamp-plugin/lib';
import { NameValueTable, SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { createRouteURL } from '@kinvolk/headlamp-plugin/lib/Router';
import Editor from '@monaco-editor/react';
import * as yaml from 'js-yaml';
import { useState } from 'react';
import { getURLSegments } from '../common/url';
import { RoutingName } from '../index';
import { applicationProfileClass } from '../model';
import { ApplicationProfile } from '../softwarecomposition/ApplicationProfile';

export function RuntimeDetection() {
  const [name, namespace] = getURLSegments(-1, -2);
  const [profileObject, setApplicationProfile] = useState<KubeObject | null>(null);

  applicationProfileClass.useApiGet(setApplicationProfile, name, namespace);

  if (!profileObject) {
    return <></>;
  }

  const profile: ApplicationProfile = profileObject.jsonData;

  return (
    <>
      <SectionBox
        title="Application Profile"
        backLink={createRouteURL(RoutingName.ApplicationProfiles)}
      >
        <NameValueTable
          rows={[
            {
              name: 'Workload',
              value: profile.metadata.labels['kubescape.io/workload-name'],
            },
            {
              name: 'Kind',
              value: profile.metadata.labels['kubescape.io/workload-kind'],
            },
            {
              name: 'Namespace',
              value: profile.metadata.namespace,
            },
          ]}
        />
      </SectionBox>
      <Editor
        language={'yaml'}
        theme={localStorage.headlampThemePreference === 'dark' ? 'vs-dark' : ''}
        value={yaml.dump(profile)}
        height={window.innerHeight * 0.6}
        width={window.innerWidth * 0.6}
        options={{
          readOnly: true,
          lineNumbers: 'off',
          automaticLayout: true,
          minimap: { enabled: false },
        }}
      />
    </>
  );
}
