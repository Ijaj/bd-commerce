import type { PrismaService } from '../prisma/prisma.service';

type Draft = { titleBn: string; en: string; bn: string };

// Placeholder copy for the six pages the migration seeds; the owner rewrites it in the admin panel.
const DRAFTS: Record<string, Draft> = {
  about: {
    titleBn: 'আমাদের সম্পর্কে',
    en: '<p>We are an online store delivering quality products across Bangladesh, with cash on delivery and easy returns.</p><p>This text is a placeholder: edit it in the admin panel under Content, Pages.</p>',
    bn: '<p>আমরা একটি অনলাইন স্টোর। ক্যাশ অন ডেলিভারি ও সহজ রিটার্নসহ সারা বাংলাদেশে মানসম্মত পণ্য পৌঁছে দিই।</p><p>এই লেখাটি সাময়িক: অ্যাডমিন প্যানেলের কনটেন্ট, পেজ থেকে এটি সম্পাদনা করুন।</p>',
  },
  contact: {
    titleBn: 'যোগাযোগ',
    en: '<p>Questions about an order or a product? Call our hotline or send us an email; our team replies during business hours.</p><p>This text is a placeholder: edit it in the admin panel.</p>',
    bn: '<p>অর্ডার বা পণ্য নিয়ে প্রশ্ন আছে? আমাদের হটলাইনে কল করুন বা ইমেইল পাঠান; কর্মঘণ্টায় আমরা উত্তর দিই।</p><p>এই লেখাটি সাময়িক: অ্যাডমিন প্যানেল থেকে সম্পাদনা করুন।</p>',
  },
  privacy: {
    titleBn: 'গোপনীয়তা নীতি',
    en: '<p>We collect only the details needed to process and deliver your orders (name, phone, address) and never sell them.</p><p>Placeholder text: have it reviewed before launch.</p>',
    bn: '<p>অর্ডার প্রসেস ও ডেলিভারির জন্য প্রয়োজনীয় তথ্য (নাম, ফোন, ঠিকানা) ছাড়া আমরা কিছু সংগ্রহ করি না এবং কখনো বিক্রি করি না।</p><p>সাময়িক লেখা: চালুর আগে যাচাই করুন।</p>',
  },
  terms: {
    titleBn: 'শর্তাবলি',
    en: '<p>By placing an order you agree to provide correct delivery details and to accept or refuse the parcel at the door as described in our returns policy.</p><p>Placeholder text: have it reviewed before launch.</p>',
    bn: '<p>অর্ডার করার মাধ্যমে আপনি সঠিক ডেলিভারি তথ্য দিতে এবং রিটার্ন নীতি অনুযায়ী পার্সেল গ্রহণ বা প্রত্যাখ্যান করতে সম্মত হচ্ছেন।</p><p>সাময়িক লেখা: চালুর আগে যাচাই করুন।</p>',
  },
  returns: {
    titleBn: 'রিটার্ন ও রিফান্ড',
    en: '<p>If an item arrives damaged or not as described, request a return from your account within the return window. Approved refunds are paid after we inspect the item.</p><p>Placeholder text: match it to your return settings.</p>',
    bn: '<p>পণ্য ক্ষতিগ্রস্ত বা বর্ণনার সঙ্গে না মিললে রিটার্ন সময়ের মধ্যে আপনার অ্যাকাউন্ট থেকে রিটার্নের অনুরোধ করুন। পণ্য পরীক্ষার পর অনুমোদিত রিফান্ড পরিশোধ করা হয়।</p><p>সাময়িক লেখা: রিটার্ন সেটিংসের সাথে মিলিয়ে নিন।</p>',
  },
  faq: {
    titleBn: 'সাধারণ জিজ্ঞাসা',
    en: '<h3>How long does delivery take?</h3><p>Usually 1-3 days inside Dhaka and 3-5 days elsewhere.</p><h3>Can I pay on delivery?</h3><p>Yes, cash on delivery is available everywhere we deliver.</p><p>Placeholder text: edit it in the admin panel.</p>',
    bn: '<h3>ডেলিভারিতে কত সময় লাগে?</h3><p>সাধারণত ঢাকার ভেতরে ১-৩ দিন এবং ঢাকার বাইরে ৩-৫ দিন।</p><h3>কি ডেলিভারির সময় টাকা দেওয়া যায়?</h3><p>হ্যাঁ, যেখানে ডেলিভারি দিই সেখানেই ক্যাশ অন ডেলিভারি আছে।</p><p>সাময়িক লেখা: অ্যাডমিন প্যানেল থেকে সম্পাদনা করুন।</p>',
  },
};

/**
 * Fills empty seeded pages with placeholder copy (EN + BN); never overwrites text someone wrote.
 * `publish` also turns the touched pages on so the footer shows them (dev convenience).
 */
export async function seedPages(prisma: PrismaService, publish: boolean) {
  const touched: string[] = [];
  for (const [slug, d] of Object.entries(DRAFTS)) {
    const page = await prisma.page.findUnique({ where: { slug } });
    if (!page) continue;
    const data: Record<string, unknown> = {};
    if (!page.bodyHtmlEn) data.bodyHtmlEn = d.en;
    if (!page.bodyHtmlBn) data.bodyHtmlBn = d.bn;
    if (!page.titleBn) data.titleBn = d.titleBn;
    if (publish && !page.isPublished) data.isPublished = true;
    if (Object.keys(data).length === 0) continue;
    await prisma.page.update({ where: { slug }, data });
    touched.push(slug);
  }
  return touched;
}
