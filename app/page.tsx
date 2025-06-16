// File: app/page.tsx
'use client';

import React, { useState } from "react";
import { PDFDocument, rgb, PDFFont } from "pdf-lib";
import fontkit from '@pdf-lib/fontkit';
import { Upload, FileText, CheckCircle2, XCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const HEADER_FONT_SIZE = 5;
const HEADER_LINE_SPACING = 8;

const createHeaderPage = (
  pdfDoc: PDFDocument,
  { width, height }: { width: number; height: number },
  font: PDFFont,
  data: { productName: string; asin: string; totalQuantity: number }
) => {
  const page = pdfDoc.addPage([width, height]);
  const { productName, asin, totalQuantity } = data;

  const leftMargin = 15;
  const rightMargin = 15;
  const maxWidth = width - leftMargin - rightMargin;
  let y = height - 25;

  page.drawText("商品:", { x: leftMargin, y, font, size: HEADER_FONT_SIZE });
  y -= HEADER_LINE_SPACING;

  let lines = [];
  let currentLine = '';
  for (let i = 0; i < productName.length; i++) {
    const char = productName[i];
    const testLine = currentLine + char;
    const textWidth = font.widthOfTextAtSize(testLine, HEADER_FONT_SIZE);

    if (textWidth > maxWidth) {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine);

  if (lines.length > 2) {
    lines = lines.slice(0, 2);
    lines[1] = `${lines[1].slice(0, Math.floor(maxWidth/5))}...`;
  }

  for (const line of lines) {
    page.drawText(line, { x: leftMargin, y, font, size: HEADER_FONT_SIZE });
    y -= HEADER_LINE_SPACING;
  }

  page.drawText(`ASIN:`, { x: leftMargin, y, font, size: HEADER_FONT_SIZE });
  page.drawText(asin, { x: leftMargin + 15, y, font, size: HEADER_FONT_SIZE });
  y -= HEADER_LINE_SPACING;

  page.drawText(`数量:`, { x: leftMargin, y, font, size: HEADER_FONT_SIZE });
  page.drawText(`${totalQuantity} pcs`, { x: leftMargin + 15, y, font, size: HEADER_FONT_SIZE });
};


const createCountPage = (
  pdfDoc: PDFDocument,
  { width, height }: { width: number; height: number },
  font: PDFFont,
  { mainText, subText }: { mainText: string; subText: string }
) => {
  const page = pdfDoc.addPage([width, height]);
  const leftMargin = 25;
  
  page.drawText(mainText, {
    x: leftMargin,
    y: height / 2 + 10,
    font: font,
    size: HEADER_FONT_SIZE + 2,
  });

  page.drawText(subText, {
    x: leftMargin,
    y: height / 2 - 10,
    font: font,
    size: HEADER_FONT_SIZE + 2,
  });
};

const SkuLabelGenerator = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string>('');

  const [productName, setProductName] = useState('测试商品名称');
  const [asin, setAsin] = useState('B012345678'.normalize('NFKC'));
  const [totalQuantity, setTotalQuantity] = useState<number | ''>(125);
  const [dividerInterval, setDividerInterval] = useState<number | ''>(50);

  const handleGenerate = async () => {
    if (!selectedFile || !totalQuantity) {
      setError("请确保已选择模板文件并填写了打印总数");
      return;
    }
    setError('');
    setProcessing(true);
    setProgress(0);

    try {
      const fontBytes = await fetch("/fonts/AlibabaPuHuiTi-Regular.ttf").then(res => res.arrayBuffer());
      const arrayBuffer = await selectedFile.arrayBuffer();

      const sourcePdfDoc = await PDFDocument.load(arrayBuffer);
      const newPdfDoc = await PDFDocument.create();

      newPdfDoc.registerFontkit(fontkit);

      const customFont = await newPdfDoc.embedFont(fontBytes);

      const sourceTemplatePage = sourcePdfDoc.getPages()[0];
      const embeddedTemplatePage = await newPdfDoc.embedPage(sourceTemplatePage);
      const { width, height } = embeddedTemplatePage;

      if (productName || asin) {
        createHeaderPage(newPdfDoc, { width, height }, customFont, { productName, asin, totalQuantity });
      }

      for (let i = 1; i <= totalQuantity; i++) {
        if (dividerInterval && i > 1 && (i - 1) % dividerInterval === 0) {
           createCountPage(newPdfDoc, { width, height }, customFont, {
            mainText: `Count: ${i - 1}`,
            subText: `ASIN: ${asin}`,
           });
        }

        const page = newPdfDoc.addPage([width, height]);
        page.drawPage(embeddedTemplatePage);

        const originText = "Made In China";
        const originTextWidth = customFont.widthOfTextAtSize(originText, 6);
        page.drawText(originText, { x: (width - originTextWidth) / 2, y: 10, size: 6, font: customFont, color: rgb(0, 0, 0) });
        
        setProgress(Math.floor((i / totalQuantity) * 95));
      }

      if (totalQuantity > 0) {
        createCountPage(newPdfDoc, { width, height }, customFont, {
          mainText: `Total Count: ${totalQuantity}`,
          subText: `ASIN: ${asin}`,
        });
      }

      setProgress(100);
      const pdfBytes = await newPdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeFileName = asin.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'labels';
      link.download = `${safeFileName.toUpperCase()}_${totalQuantity}pcs.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (e) {
      console.error(e);
      setError(`处理PDF时出错: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setProcessing(false);
      setTimeout(() => { if (!error) setProgress(0); }, 2000);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'application/pdf') { setSelectedFile(file); setError(''); }
    else { setError("请拖入一个有效的 PDF 文件"); setSelectedFile(null); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') { setSelectedFile(file); setError(''); }
    else { setError("请选择一个有效的 PDF 文件"); setSelectedFile(null); }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>SKU 标签生成与处理器</CardTitle>
          <CardDescription>从 SKU 模板生成带计数分隔页的完整标签 PDF</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="product-name">商品名称</Label>
                <Input id="product-name" placeholder="例如: 硅胶手机壳" value={productName} onChange={(e) => setProductName(e.target.value)} disabled={processing} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="asin">ASIN</Label>
                <Input id="asin" placeholder="例如: B08XXXXXXX" value={asin} onChange={(e) => setAsin(e.target.value.normalize('NFKC'))} disabled={processing}/>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="total-quantity">打印总数 (必填)</Label>
              <Input id="total-quantity" type="number" placeholder="例如: 500" value={totalQuantity} onChange={(e) => setTotalQuantity(e.target.value === '' ? '' : Number(e.target.value))} required disabled={processing}/>
            </div>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>高级选项: 设置分隔页</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    <Label htmlFor="divider-interval">每隔多少个标签插入一张分隔页?</Label>
                    <Input id="divider-interval" type="number" placeholder="例如: 50 (表示每50个标签后插入)" value={dividerInterval} onChange={(e) => setDividerInterval(e.target.value === '' ? '' : Number(e.target.value))} disabled={processing}/>
                    <p className="text-xs text-muted-foreground">留空则不插入分隔页</p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
          
          <div>
            <Label>SKU 模板 (PDF)</Label>
            <div
              className={`mt-1 border-2 border-dashed rounded-lg p-6 text-center transition-colors ${ isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300' }`}
              onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
            >
              <input type="file" id="file-upload" className="hidden" accept=".pdf" onChange={handleFileSelect} />
              {!selectedFile ? (
                <div className="flex flex-col items-center justify-center">
                  <Upload className="w-10 h-10 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600 mb-2">拖拽单个 PDF 文件到这里, 或</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('file-upload')?.click()} disabled={processing}>选择文件</Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-sm">
                  <FileText className="w-10 h-10 text-green-600 mb-2" />
                  <p className="font-medium">{selectedFile.name}</p>
                  <Button type="button" variant="link" size="sm" className="text-red-500 hover:text-red-700" onClick={() => setSelectedFile(null)} disabled={processing}>移除文件</Button>
                </div>
              )}
            </div>
          </div>
          
          <div className="space-y-4">
            {error && (<div className="flex items-center p-2 text-sm text-destructive bg-destructive/10 rounded-md"><XCircle className="w-4 h-4 mr-2"/><p>{error}</p></div>)}
            {processing && progress === 100 && !error && (<div className="flex items-center p-2 text-sm text-green-700 bg-green-500/10 rounded-md"><CheckCircle2 className="w-4 h-4 mr-2"/><p>处理完成！下载已开始</p></div>)}
            <Button onClick={handleGenerate} disabled={!selectedFile || !totalQuantity || processing} className="w-full">{processing ? '正在生成中...' : '生成标签'}</Button>
            {processing && (<div className="mt-2"><Progress value={progress} className="w-full" /><p className="text-sm text-gray-500 mt-1 text-center">{progress}%</p></div>)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SkuLabelGenerator;