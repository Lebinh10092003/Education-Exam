import { useEffect, useMemo, useState } from "react";
import { Download, Eye, FileCode2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import type { ImportTemplateDefinition, ImportTemplateFormatDefinition } from "../../lib/importTemplates";

interface ImportTemplateActionsProps {
  template: ImportTemplateDefinition;
  selectedFormat?: string;
}

const downloadTemplateFile = (format: ImportTemplateFormatDefinition) => {
  const blob = new Blob([format.downloadContent], { type: format.mimeType });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = format.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
};

export function ImportTemplateActions({
  template,
  selectedFormat,
}: ImportTemplateActionsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const defaultFormat = selectedFormat ?? template.formats[0]?.key ?? "";
  const [previewFormat, setPreviewFormat] = useState(defaultFormat);

  useEffect(() => {
    if (defaultFormat) {
      setPreviewFormat(defaultFormat);
    }
  }, [defaultFormat]);

  const activeFormat = useMemo(
    () =>
      template.formats.find((format) => format.key === previewFormat) ??
      template.formats[0],
    [previewFormat, template.formats],
  );

  const downloadFormat = useMemo(
    () =>
      template.formats.find((format) => format.key === selectedFormat) ??
      activeFormat,
    [activeFormat, selectedFormat, template.formats],
  );

  if (!activeFormat) {
    return null;
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button className="flex-1 sm:flex-none" variant="outline" size="sm" type="button" onClick={() => setIsDialogOpen(true)}>
          <Eye className="mr-2 h-4 w-4" />
          View Template
        </Button>
        <Button
          className="flex-1 sm:flex-none"
          variant="outline"
          size="sm"
          type="button"
          onClick={() => downloadTemplateFile(downloadFormat)}
        >
          <Download className="mr-2 h-4 w-4" />
          Download Template
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-5xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>{template.title}</DialogTitle>
            <DialogDescription>{template.description}</DialogDescription>
          </DialogHeader>

          {template.formats.length > 1 ? (
            <Tabs value={previewFormat} onValueChange={setPreviewFormat} className="py-2">
              <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-xl bg-transparent p-0">
                {template.formats.map((format) => (
                  <TabsTrigger key={format.key} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2" value={format.key}>
                    {format.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {template.formats.map((format) => (
                <TabsContent key={format.key} value={format.key} className="min-w-0">
                  <TemplateFormatPanel format={format} />
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <div className="py-2">
              <TemplateFormatPanel format={activeFormat} />
            </div>
          )}

          {template.footerNote ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              {template.footerNote}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>
              Close
            </Button>
            <Button type="button" onClick={() => downloadTemplateFile(activeFormat)}>
              <Download className="mr-2 h-4 w-4" />
              Download {activeFormat.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TemplateFormatPanel({ format }: { format: ImportTemplateFormatDefinition }) {
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <FileCode2 className="h-4 w-4 text-gray-500" />
            <span className="font-medium text-gray-900">{format.label} Template</span>
          </div>
          <p className="text-sm text-gray-600">Suggested file name: {format.fileName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {format.requiredFields.map((field) => (
            <Badge key={field} variant="outline">
              {field}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[1.1fr_1.4fr]">
        <div className="min-w-0 rounded-xl border border-gray-200 p-4">
          <h4 className="mb-3 text-sm font-semibold text-gray-900">Mapping Notes</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            {format.mappingNotes.map((note) => (
              <li key={note} className="rounded-lg bg-gray-50 px-3 py-2">
                {note}
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0 rounded-xl border border-gray-200 p-4">
          <h4 className="mb-3 text-sm font-semibold text-gray-900">Sample Rows</h4>
          <pre className="max-h-[42dvh] overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100">
            <code>{format.sample}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
