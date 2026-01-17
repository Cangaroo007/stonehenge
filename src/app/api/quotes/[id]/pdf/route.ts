import { NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import prisma from '@/lib/db';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

async function getQuote(id: number) {
  return prisma.quote.findUnique({
    where: { id },
    include: {
      customer: true,
      rooms: {
        orderBy: { sortOrder: 'asc' },
        include: {
          pieces: {
            orderBy: { sortOrder: 'asc' },
            include: {
              features: true,
              material: true,
            },
          },
        },
      },
    },
  });
}

function formatCurrency(value: number | { toString(): string }): string {
  const num = typeof value === 'number' ? value : parseFloat(value.toString());
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(num);
}

function formatDate(date: Date): string {
  return format(new Date(date), 'dd/MM/yyyy');
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const quote = await getQuote(parseInt(id));

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    // Company details
    const company = {
      name: process.env.COMPANY_NAME || 'Northcoast Stone Pty Ltd',
      abn: process.env.COMPANY_ABN || '57 120 880 355',
      address: process.env.COMPANY_ADDRESS || '20 Hitech Drive, KUNDA PARK Queensland 4556, Australia',
      phone: process.env.COMPANY_PHONE || '0754767636',
      fax: process.env.COMPANY_FAX || '0754768636',
      email: process.env.COMPANY_EMAIL || 'admin@northcoaststone.com.au',
    };

    // Parse decimal values
    const subtotal = parseFloat(quote.subtotal.toString());
    const taxAmount = parseFloat(quote.taxAmount.toString());
    const total = parseFloat(quote.total.toString());
    const taxRate = parseFloat(quote.taxRate.toString());

    // Create PDF
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    // Page 1 - Cover
    // Header
    doc.fontSize(24).font('Helvetica-Bold').text(company.name, 40, 40);
    doc.fontSize(9).font('Helvetica').fillColor('#666').text(`ABN: ${company.abn}`, 40, 70);
    doc.fontSize(9).fillColor('#333').text(company.address, 40, 85);
    doc.text(`Phone: ${company.phone} | Fax: ${company.fax}`, 40, 100);

    // Divider
    doc.moveTo(40, 130).lineTo(555, 130).strokeColor('#ccc').stroke();

    // Quote Title
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#2563eb')
      .text(`Quote - ${quote.quoteNumber} - ${quote.projectName || 'Untitled Project'}`, 40, 150);
    doc.fontSize(10).font('Helvetica').fillColor('#666')
      .text(`Revision ${quote.revision}`, 40, 175);
    doc.fontSize(10).fillColor('#333')
      .text(`Date: ${formatDate(quote.createdAt)}`, 450, 150);

    // Customer
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#000').text('For:', 40, 210);
    doc.fontSize(12).font('Helvetica').fillColor('#333')
      .text(`${quote.customer?.name || 'No customer specified'}${quote.customer?.company ? ` - ${quote.customer.company}` : ''}`, 40, 225);

    // Introduction
    const introY = 260;
    doc.fontSize(10).fillColor('#333');
    doc.text('Please see below for our price breakdown for your quotation as per the plans supplied. Any differences in stonework at measure and fabrication stage will be charged accordingly.', 40, introY, { width: 515 });
    doc.text('This quote is for supply, fabrication and local installation of stonework.', 40, introY + 35, { width: 515 });
    doc.text('Thank you for the opportunity in submitting this quotation. We look forward to working with you.', 40, introY + 55, { width: 515 });

    // Please Note box
    const noteY = introY + 90;
    doc.rect(40, noteY, 515, 50).fillColor('#fef3c7').fill();
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#000').text('PLEASE NOTE:', 50, noteY + 10);
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#333')
      .text('This Quote is based on the proviso that all stonework is the same colour and fabricated and installed at the same time. Any variation from this assumption will require re-quoting.', 50, noteY + 25, { width: 495 });

    // Totals
    const totalsY = noteY + 70;
    doc.fontSize(10).font('Helvetica').fillColor('#333').text('Cost:', 40, totalsY);
    doc.font('Helvetica-Bold').text(formatCurrency(subtotal), 120, totalsY);
    doc.font('Helvetica').text('GST:', 40, totalsY + 18);
    doc.font('Helvetica-Bold').text(formatCurrency(taxAmount), 120, totalsY + 18);
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#333').text('Total Including GST:', 40, totalsY + 45);
    doc.fillColor('#2563eb').text(formatCurrency(total), 180, totalsY + 45);

    // Terms
    const termsY = totalsY + 80;
    doc.fontSize(8).font('Helvetica').fillColor('#666');
    doc.text(`Upon acceptance of this quotation I hereby certify that the above information is true and correct. I have read and understand the TERMS AND CONDITIONS OF TRADE OF ${company.name.toUpperCase()} which forms part of, and is intended to read in conjunction with this quotation. I agree to be bound by these conditions. I authorise the use of my personal information as detailed in the Privacy Act Clause therein. I agree that if I am a Director or a shareholder (owning at least 15% of the shares) of the client I shall be personally liable for the performance of the client's obligations under this act.`, 40, termsY, { width: 515 });
    
    doc.text('Please read this quote carefully for all details regarding edge thickness, stone colour and work description. We require a 50% deposit and completed purchase order upon acceptance of this quote.', 40, termsY + 55, { width: 515 });
    
    doc.text(`Please contact our office via email ${company.email} if you wish to proceed.`, 40, termsY + 85, { width: 515 });
    
    doc.text('This quote is valid for 30 days, on the exception of being signed off as a job, where it will be valid for a 3 month period.', 40, termsY + 100, { width: 515 });

    // Signature
    const sigY = termsY + 140;
    doc.fontSize(10).fillColor('#000').text('Yours Sincerely', 40, sigY);
    doc.font('Helvetica-Bold').text('Beau Kavanagh', 40, sigY + 40);
    doc.font('Helvetica').fillColor('#666').text(company.name, 40, sigY + 55);

    // Page footer
    doc.fontSize(9).fillColor('#666').text('Page 1 of 2', 500, 800);

    // Page 2 - Breakdown
    doc.addPage();

    doc.fontSize(14).font('Helvetica-Bold').fillColor('#000')
      .text(`${quote.projectName || 'Project'} Breakdown`, 40, 40);

    let yPos = 70;

    for (const room of quote.rooms) {
      // Check if we need a new page
      if (yPos > 700) {
        doc.addPage();
        yPos = 40;
      }

      // Room header
      doc.rect(40, yPos, 515, 22).fillColor('#f3f4f6').fill();
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#000')
        .text(room.name.toUpperCase(), 46, yPos + 6);
      yPos += 30;

      for (const piece of room.pieces) {
        // Check if we need a new page
        if (yPos > 700) {
          doc.addPage();
          yPos = 40;
        }

        const pieceTotal = parseFloat(piece.totalCost.toString());
        const areaSqm = parseFloat(piece.areaSqm.toString());

        doc.fontSize(10).font('Helvetica-Bold').fillColor('#000')
          .text(piece.description || 'Stone piece', 46, yPos);
        yPos += 14;

        doc.fontSize(9).font('Helvetica').fillColor('#666')
          .text(`${piece.lengthMm} x ${piece.widthMm} x ${piece.thicknessMm}mm (${areaSqm.toFixed(2)} m2)`, 46, yPos);
        yPos += 12;

        if (piece.materialName) {
          doc.fillColor('#333').text(`Material: ${piece.materialName}`, 46, yPos);
          yPos += 12;
        }

        if (piece.features.length > 0) {
          for (const feature of piece.features) {
            doc.fontSize(8).fillColor('#666')
              .text(`- ${feature.quantity}x ${feature.name}`, 56, yPos);
            yPos += 10;
          }
        }

        doc.fontSize(10).font('Helvetica-Bold').fillColor('#000')
          .text(formatCurrency(pieceTotal), 480, yPos - 10, { width: 75, align: 'right' });

        // Divider line
        doc.moveTo(46, yPos + 5).lineTo(555, yPos + 5).strokeColor('#e5e7eb').stroke();
        yPos += 15;
      }

      yPos += 10;
    }

    // Notes
    if (quote.notes) {
      if (yPos > 650) {
        doc.addPage();
        yPos = 40;
      }
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000').text('Notes:', 40, yPos);
      yPos += 15;
      doc.fontSize(9).font('Helvetica').fillColor('#666').text(quote.notes, 40, yPos, { width: 515 });
      yPos += 30;
    }

    // Page 2 totals
    if (yPos > 700) {
      doc.addPage();
      yPos = 40;
    }
    
    doc.moveTo(40, yPos).lineTo(555, yPos).strokeColor('#ccc').stroke();
    yPos += 15;

    doc.fontSize(10).font('Helvetica').fillColor('#333').text('Total Excl. GST', 40, yPos);
    doc.font('Helvetica-Bold').text(formatCurrency(subtotal), 150, yPos);
    yPos += 15;
    
    doc.font('Helvetica').text(`GST (${taxRate}%)`, 40, yPos);
    doc.font('Helvetica-Bold').text(formatCurrency(taxAmount), 150, yPos);
    yPos += 20;
    
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#333').text('Total Incl. GST', 40, yPos);
    doc.fillColor('#2563eb').text(formatCurrency(total), 150, yPos);

    // Page 2 footer
    doc.fontSize(9).fillColor('#666').text('Page 2 of 2', 500, 800);

    // Finalize PDF
    doc.end();

    // Wait for PDF to finish generating
    const pdfBuffer = await new Promise<Buffer>((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });

    // Return buffer as Uint8Array for Node.js Response compatibility
    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${quote.quoteNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
