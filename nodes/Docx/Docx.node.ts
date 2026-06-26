import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { convert } from '../../src/convert';
import type { Format } from '../../src/types';

const FROM_OPTIONS = [
  { name: 'Auto-Detect', value: 'auto' },
  { name: 'Word (DOCX)', value: 'docx' },
  { name: 'Excel (XLSX)', value: 'xlsx' },
  { name: 'Markdown (MD)', value: 'md' },
  { name: 'PDF', value: 'pdf' },
  { name: 'HTML', value: 'html' },
];

const TO_OPTIONS = [
  { name: 'PDF', value: 'pdf' },
  { name: 'Word (DOCX)', value: 'docx' },
  { name: 'Excel (XLSX)', value: 'xlsx' },
  { name: 'Markdown (MD)', value: 'md' },
  { name: 'HTML', value: 'html' },
  { name: 'Plain Text (TXT)', value: 'txt' },
];

export class Docx implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'DocX Convert',
    name: 'docx',
    icon: 'file:docx.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{ ($parameter["from"] === "auto" ? "auto" : $parameter["from"]) + " → " + $parameter["to"] }}',
    description: 'Convert documents between Word, Excel, Markdown, PDF and more',
    defaults: {
      name: 'DocX Convert',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        displayName: 'Source Format',
        name: 'from',
        type: 'options',
        options: FROM_OPTIONS,
        default: 'auto',
        description: 'Format of the incoming binary. Auto-detect uses the filename and file signature.',
      },
      {
        displayName: 'Target Format',
        name: 'to',
        type: 'options',
        options: TO_OPTIONS,
        default: 'pdf',
        description: 'Format to convert the document into',
      },
      {
        displayName: 'Input Binary Property',
        name: 'inputProperty',
        type: 'string',
        default: 'data',
        required: true,
        description: 'Name of the binary property that holds the source document',
      },
      {
        displayName: 'Output Binary Property',
        name: 'outputProperty',
        type: 'string',
        default: 'data',
        required: true,
        description: 'Name of the binary property to write the converted document to',
      },
      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        options: [
          {
            displayName: 'Output File Name',
            name: 'fileName',
            type: 'string',
            default: '',
            placeholder: 'converted',
            description: 'Base name (without extension) for the output file. Defaults to the input file name.',
          },
        ],
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const fromParam = this.getNodeParameter('from', i) as string;
        const to = this.getNodeParameter('to', i) as Format;
        const inputProperty = this.getNodeParameter('inputProperty', i) as string;
        const outputProperty = this.getNodeParameter('outputProperty', i) as string;
        const options = this.getNodeParameter('options', i, {}) as {
          fileName?: string;
        };

        const binary = items[i].binary?.[inputProperty];
        if (!binary) {
          throw new NodeOperationError(
            this.getNode(),
            `No binary data found on property "${inputProperty}"`,
            { itemIndex: i },
          );
        }

        const inputBuffer = await this.helpers.getBinaryDataBuffer(i, inputProperty);

        const res = await convert(inputBuffer, {
          from: fromParam === 'auto' ? undefined : (fromParam as Format),
          to,
          filename: binary.fileName,
        });

        const baseName =
          options.fileName ||
          (binary.fileName ? binary.fileName.replace(/\.[^.]+$/, '') : 'converted');
        const outFileName = `${baseName}.${res.ext}`;

        const outBinary = await this.helpers.prepareBinaryData(res.data, outFileName, res.mime);

        returnData.push({
          json: {
            ...items[i].json,
            from: fromParam,
            to,
            fileName: outFileName,
            mimeType: res.mime,
            size: res.data.length,
          },
          binary: { ...items[i].binary, [outputProperty]: outBinary },
          pairedItem: { item: i },
        });
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: { ...items[i].json, error: (error as Error).message },
            pairedItem: { item: i },
          });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}
