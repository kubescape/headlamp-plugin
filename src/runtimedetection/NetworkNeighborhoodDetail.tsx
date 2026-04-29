import { NameValueTable, SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { KubeObject } from '@kinvolk/headlamp-plugin/lib/k8s/KubeObject';
import Editor from '@monaco-editor/react';
import * as yaml from 'js-yaml';
import { useState } from 'react';
import { getURLSegments } from '../common/url';
import { networkNeighborhoodsClass } from '../model';

export function NetworkNeighborhoodDetail() {
  const [name, namespace] = getURLSegments(-1, -2);
  const [item, setItem] = useState<KubeObject | null>(null);

  networkNeighborhoodsClass.useApiGet(setItem, name, namespace);

  if (!item) {
    return <></>;
  }

  const nn = item.jsonData;

  return (
    <>
      <SectionBox title="Network Neighborhood" backLink>
        <NameValueTable
          rows={[
            {
              name: 'Workload',
              value: nn.metadata.labels?.['kubescape.io/workload-name'] ?? nn.metadata.name,
            },
            {
              name: 'Kind',
              value: nn.metadata.labels?.['kubescape.io/workload-kind'],
            },
            {
              name: 'Namespace',
              value: nn.metadata.namespace,
            },
            {
              name: 'Containers',
              value: String(nn.spec?.containers?.length ?? 0),
            },
          ]}
        />
      </SectionBox>
      <Editor
        language={'yaml'}
        theme={localStorage.headlampThemePreference === 'dark' ? 'vs-dark' : ''}
        value={yaml.dump(nn)}
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
