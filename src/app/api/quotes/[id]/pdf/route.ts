import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import prisma from '@/lib/db';
import QuotePDF from '@/components/QuotePDF';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const quote = await getQuote(parseInt(id));

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    // Company details from environment or defaults
    const companyInfo = {
      name: process.env.COMPANY_NAME || 'Northcoast Stone Pty Ltd',
      abn: process.env.COMPANY_ABN || '57 120 880 355',
      address: process.env.COMPANY_ADDRESS || '20 Hitech Drive, KUNDA PARK Queensland 4556, Australia',
      phone: process.env.COMPANY_PHONE || '0754767636',
      fax: process.env.COMPANY_FAX || '0754768636',
      email: process.env.COMPANY_EMAIL || 'admin@northcoaststone.com.au',
    };

    // Generate PDF buffer
    const pdfBuffer = await renderToBuffer(
      QuotePDF({ quote, companyInfo })
    );

    // Return PDF response
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${quote.quoteNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
