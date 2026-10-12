export interface TemplateItem {
  id: string;
  name: string;
  category: string;
  badge: string;
  badgeColor: string;
  subject: string;
  description: string;
  html: string;
}

export const SIGNALPOST_MASTER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Brand | Master Email Template</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, p, span, a {font-family: Arial, sans-serif !important;}
  </style>
  <![endif]-->
  <style>
    @media screen and (max-width: 600px) {
      .responsive-col {
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        padding: 0 0 20px 0 !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f0eee6; -webkit-font-smoothing: antialiased;">

<table style="background-color: #f0eee6;" role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0">
  <tbody>
    <tr>
      <td class="ep-outer-td" style="padding: 36px 0px;" align="center">
        <table class="ep-wrap" style="max-width: 680px; width: 100%; background-color: #fafaf7; border-radius: 20px; overflow: hidden;" role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0">
          
          <!-- ================= HEADER ================= -->
          <tbody>
            <tr>
              <td class="ep-header-pad" style="background-color: #191970; border-radius: 20px 20px 0 0; padding: 44px 44px 40px 44px;" bgcolor="#191970">
                <!-- Topbar -->
                <table style="margin-bottom: 36px;" role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0">
                  <tbody>
                    <tr>
                      <td style="width: 38px;" valign="middle"><img style="display: block; width: 38px; height: 38px;" src="https://placehold.co/38x38/ffffff/191970.png?text=Y" alt="Your brand mark" width="38" height="38"></td>
                      <td style="padding-left: 10px;" valign="middle"><span style="font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 18px; font-weight: bold; color: #ffffff; letter-spacing: -0.3px;">Your Brand</span></td>
                    </tr>
                  </tbody>
                </table>
                
                <p style="margin: 0 0 14px 0; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 2.5px; text-transform: uppercase; color: #ffbf00;">/\\__EYEBROW TEXT__/\\</p>
                <h1 class="ep-headline-text" style="margin: 0 0 18px 0; font-family: 'Playfair Display', Georgia, serif; font-size: 36px; font-weight: 900; line-height: 1.1; letter-spacing: -1px; color: #ffffff;">/\\__HEADER__/\\</h1>
                <p style="margin: 0; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 15px; font-weight: 400; line-height: 1.7; color: #bbbbcc; max-width: 480px;">/\\__HEADER SUBLINE__/\\</p>
              </td>
            </tr>
            <!-- ================= END HEADER ================= -->

            <!-- ================= BODY ================= -->
            <tr>
              <td class="ep-body-pad" style="background-color: #fafaf7; padding: 36px 32px;" bgcolor="#FAFAF7">
                
                <!-- 1. HERO IMAGE / BANNER PLACEHOLDER -->
                <table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                  <tbody>
                    <tr>
                      <td>
                        <img src="https://placehold.co/600x250/191970/ffffff?text=Hero+Banner+Placeholder" alt="Hero Banner" width="100%" style="display: block; width: 100%; max-width: 100%; border-radius: 12px; height: auto;" />
                      </td>
                    </tr>
                  </tbody>
                </table>

                <!-- 2. USER PROFILE / ACCOUNT BLOCK -->
                <table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #ebe9e1; margin-bottom: 24px;">
                  <tbody>
                    <tr>
                      <td style="padding: 16px 20px;">
                        <table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0">
                          <tbody>
                            <tr>
                              <td style="width: 44px;" valign="middle">
                                <img src="https://placehold.co/80x80/191970/ffbf00?text=U" alt="User" width="44" height="44" style="display: block; border-radius: 50%;" />
                              </td>
                              <td style="padding-left: 14px;" valign="middle">
                                <p style="margin: 0 0 2px 0; font-family: 'Playfair Display', Georgia, serif; font-size: 16px; font-weight: bold; color: #191970;">/\\__USER_NAME__/\\</p>
                                <p style="margin: 0; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 13px; color: #6b6b70;">Account ending in •••• /\\__LAST_4__/\\</p>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <!-- 3. NORMAL TEXT -->
                <p style="margin: 0 0 24px 0; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 15px; line-height: 1.75; color: #2a2a35;">/\\__NORMAL TEXT__/\\ <strong>/\\__BOLD TEXT__/\\</strong> /\\__NORMAL TEXT__/\\</p>

                <!-- 4. ALERT BOXES (GOLD & RED) -->
                <!-- Gold Variant -->
                <table style="background-color: #fff8e6; border-radius: 12px; margin-bottom: 16px; border-left: 4px solid #ffbf00;" role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0" bgcolor="#FFF8E6">
                  <tbody>
                    <tr>
                      <td style="padding: 20px 24px;">
                        <p style="margin: 0; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 14px; font-weight: 600; color: #191970; line-height: 1.6;">/\\__HIGHLIGHTED TEXT (GOLD)__/\\</p>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <!-- Red Warning Variant -->
                <table style="background-color: #fff0f0; border-radius: 12px; margin-bottom: 24px; border-left: 4px solid #cc3333;" role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0" bgcolor="#FFF0F0">
                  <tbody>
                    <tr>
                      <td style="padding: 20px 24px;">
                        <p style="margin: 0; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 14px; font-weight: 600; color: #cc3333; line-height: 1.6;">/\\__WARNING TEXT (RED)__/\\</p>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <!-- 5. PROMO CODE / REFERRAL BLOCK -->
                <table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                  <tbody>
                    <tr>
                      <td style="background-color: #fff8e6; border: 2px dashed #ffbf00; border-radius: 12px; padding: 24px; text-align: center;">
                        <p style="margin: 0 0 10px 0; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 13px; font-weight: 600; color: #191970; text-transform: uppercase; letter-spacing: 1px;">/\\__PROMO TITLE__/\\</p>
                        <p style="margin: 0; font-family: 'Playfair Display', Georgia, serif; font-size: 28px; font-weight: 900; color: #191970; letter-spacing: 2px;">/\\__CODE_HERE__/\\</p>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <!-- 6. THEMATIC DIVIDER -->
                <table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                  <tbody>
                    <tr>
                      <td style="border-top: 1px solid #e2e0d8; font-size: 0; line-height: 0;" height="1">&nbsp;</td>
                    </tr>
                  </tbody>
                </table>

                <!-- 7. TWO-COLUMN FEATURE GRID -->
                <table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                  <tbody>
                    <tr>
                      <td class="responsive-col" width="48%" valign="top" style="background-color: #ffffff; padding: 20px; border-radius: 12px; border: 1px solid #ebe9e1;">
                        <p style="margin: 0 0 8px 0; font-size: 24px; line-height: 1;">⚡</p>
                        <p style="margin: 0 0 6px 0; font-family: 'Playfair Display', Georgia, serif; font-size: 16px; font-weight: bold; color: #191970;">/\\__FEATURE 1 TITLE__/\\</p>
                        <p style="margin: 0; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #6b6b70;">/\\__FEATURE 1 TEXT__/\\</p>
                      </td>
                      <td width="4%" style="font-size: 0; line-height: 0;">&nbsp;</td> <!-- Spacer -->
                      <td class="responsive-col" width="48%" valign="top" style="background-color: #ffffff; padding: 20px; border-radius: 12px; border: 1px solid #ebe9e1;">
                        <p style="margin: 0 0 8px 0; font-size: 24px; line-height: 1;">🔒</p>
                        <p style="margin: 0 0 6px 0; font-family: 'Playfair Display', Georgia, serif; font-size: 16px; font-weight: bold; color: #191970;">/\\__FEATURE 2 TITLE__/\\</p>
                        <p style="margin: 0; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #6b6b70;">/\\__FEATURE 2 TEXT__/\\</p>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <!-- 8. NUMBERED / STEP-BY-STEP LIST -->
                <table style="background-color:#ffffff;border-radius:18px;margin-bottom:24px;border:1px solid #ebe9e1;" role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0" bgcolor="#FFFFFF">
                  <tbody>
                    <tr>
                      <td style="padding:26px 24px;">
                        <p style="margin:0 0 18px 0;font-family:'Playfair Display',Georgia,serif;font-size:20px;font-weight:bold;color:#191970;letter-spacing:-0.3px;">/\\__STEPS HEADER__/\\</p>

                        <!-- STEP 1 -->
                        <table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:14px;">
                          <tbody>
                            <tr>
                              <td width="34" valign="top" style="padding:3px 10px 0 0;">
                                <table role="presentation" border="0" width="28" height="28" cellspacing="0" cellpadding="0" style="background-color:#191970;border-radius:50%;">
                                  <tbody>
                                    <tr>
                                      <td align="center" valign="middle" style="font-family:'Source Sans Pro',Arial,sans-serif;font-size:12px;font-weight:700;color:#ffffff;">1</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                              <td valign="top" style="padding:0 0 14px 0;border-bottom:1px solid #ebe9e1;">
                                <p style="margin:0 0 6px 0;font-family:'Playfair Display',Georgia,serif;font-size:15px;font-weight:bold;color:#191970;">/\\__STEP 1 TITLE__/\\</p>
                                <p style="margin:0;font-family:'Source Sans Pro',Arial,sans-serif;font-size:13px;color:#6b6b70;line-height:1.55;">/\\__STEP 1 DESCRIPTION__/\\</p>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <!-- STEP 2 -->
                        <table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0">
                          <tbody>
                            <tr>
                              <td width="34" valign="top" style="padding:3px 10px 0 0;">
                                <table role="presentation" border="0" width="28" height="28" cellspacing="0" cellpadding="0" style="background-color:#191970;border-radius:50%;">
                                  <tbody>
                                    <tr>
                                      <td align="center" valign="middle" style="font-family:'Source Sans Pro',Arial,sans-serif;font-size:12px;font-weight:700;color:#ffffff;">2</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                              <td valign="top" style="padding:0;">
                                <p style="margin:0 0 6px 0;font-family:'Playfair Display',Georgia,serif;font-size:15px;font-weight:bold;color:#191970;">/\\__STEP 2 TITLE__/\\</p>
                                <p style="margin:0;font-family:'Source Sans Pro',Arial,sans-serif;font-size:13px;color:#6b6b70;line-height:1.55;">/\\__STEP 2 DESCRIPTION__/\\</p>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <!-- 9. STANDARD DATA TABLE -->
                <div style="margin-bottom: 24px; border-radius: 12px; overflow: hidden; border: 1px solid #ebe9e1;">
                  <table style="width: 100%; background-color: #ffffff;" role="presentation" border="0" cellspacing="0" cellpadding="0" bgcolor="#FFFFFF">
                    <thead>
                      <tr>
                        <th style="background-color: #f0eee6; padding: 14px 20px; text-align: left; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 12px; font-weight: 700; color: #191970; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e2e0d8;">/\\__TABLE HEADER__/\\</th>
                        <th style="background-color: #f0eee6; padding: 14px 20px; text-align: right; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 12px; font-weight: 700; color: #191970; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e2e0d8;">/\\__TABLE HEADER__/\\</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style="padding: 16px 20px; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 14px; color: #6b6b70; border-bottom: 1px solid #ebe9e1;">/\\__TABLE DATA__/\\</td>
                        <td style="padding: 16px 20px; text-align: right; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 14px; color: #2a2a35; font-weight: 600; border-bottom: 1px solid #ebe9e1;">/\\__TABLE DATA__/\\</td>
                      </tr>
                      <tr>
                        <td style="padding: 16px 20px; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 14px; color: #6b6b70; border-bottom: 1px solid #ebe9e1;">/\\__TABLE DATA__/\\</td>
                        <td style="padding: 16px 20px; text-align: right; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 14px; color: #2a2a35; font-weight: 600; border-bottom: 1px solid #ebe9e1;">/\\__TABLE DATA__/\\</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- 10. RECEIPT / TRANSACTION BREAKDOWN -->
                <table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #ebe9e1; margin-bottom: 24px; overflow: hidden;">
                  <tbody>
                    <tr>
                      <td style="padding: 24px; border-bottom: 1px dashed #e2e0d8;">
                        <p style="margin: 0 0 4px 0; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6b6b70;">Transaction Receipt</p>
                        <p style="margin: 0; font-family: 'Playfair Display', Georgia, serif; font-size: 24px; font-weight: bold; color: #191970;">/\\__$0.00__/\\</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 20px 24px;">
                        <table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0">
                          <tbody>
                            <tr>
                              <td style="padding: 0 0 12px 0; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 13px; color: #6b6b70;">Date</td>
                              <td align="right" style="padding: 0 0 12px 0; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 13px; font-weight: bold; color: #2a2a35;">/\\__DATE__/\\</td>
                            </tr>
                            <tr>
                              <td style="padding: 0 0 12px 0; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 13px; color: #6b6b70;">Transaction ID</td>
                              <td align="right" style="padding: 0 0 12px 0; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 13px; font-weight: bold; color: #2a2a35;">/\\__TXN_ID__/\\</td>
                            </tr>
                            <tr>
                              <td style="padding: 0 0 12px 0; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 13px; color: #6b6b70;">Subtotal</td>
                              <td align="right" style="padding: 0 0 12px 0; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 13px; font-weight: bold; color: #2a2a35;">/\\__$0.00__/\\</td>
                            </tr>
                            <tr>
                              <td style="padding: 0 0 16px 0; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 13px; color: #6b6b70; border-bottom: 1px solid #ebe9e1;">Fees</td>
                              <td align="right" style="padding: 0 0 16px 0; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 13px; font-weight: bold; color: #2a2a35; border-bottom: 1px solid #ebe9e1;">/\\__$0.00__/\\</td>
                            </tr>
                            <tr>
                              <td style="padding: 16px 0 0 0; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 15px; font-weight: bold; color: #191970;">Total</td>
                              <td align="right" style="padding: 16px 0 0 0; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 16px; font-weight: bold; color: #191970;">/\\__$0.00__/\\</td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <!-- 11. PROGRESS TRACKER / TIMELINE -->
                <table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #ebe9e1; margin-bottom: 24px;">
                  <tbody>
                    <tr>
                      <td style="padding: 24px;">
                        <p style="margin: 0 0 16px 0; font-family: 'Playfair Display', Georgia, serif; font-size: 18px; font-weight: bold; color: #191970;">Transfer Status</p>
                        
                        <!-- Timeline Node 1 (Completed) -->
                        <table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0">
                          <tbody>
                            <tr>
                              <td width="20" valign="top" align="center">
                                <div style="width: 12px; height: 12px; background-color: #1e8e3e; border-radius: 50%;"></div>
                                <div style="width: 2px; height: 30px; background-color: #1e8e3e;"></div>
                              </td>
                              <td valign="top" style="padding: 0 0 16px 12px;">
                                <p style="margin: -2px 0 2px 0; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 14px; font-weight: bold; color: #191970;">Initiated</p>
                                <p style="margin: 0; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 12px; color: #6b6b70;">Sep 22, 10:00 AM</p>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        
                        <!-- Timeline Node 2 (In Progress - Gold) -->
                        <table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0">
                          <tbody>
                            <tr>
                              <td width="20" valign="top" align="center">
                                <div style="width: 12px; height: 12px; background-color: #ffbf00; border-radius: 50%; box-shadow: 0 0 0 3px rgba(255,191,0,0.2);"></div>
                                <div style="width: 2px; height: 30px; background-color: #e2e0d8;"></div>
                              </td>
                              <td valign="top" style="padding: 0 0 16px 12px;">
                                <p style="margin: -2px 0 2px 0; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 14px; font-weight: bold; color: #191970;">Processing</p>
                                <p style="margin: 0; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 12px; color: #6b6b70;">Estimated 1-2 days</p>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <!-- Timeline Node 3 (Pending - Gray) -->
                        <table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0">
                          <tbody>
                            <tr>
                              <td width="20" valign="top" align="center">
                                <div style="width: 10px; height: 10px; background-color: #ffffff; border: 2px solid #e2e0d8; border-radius: 50%;"></div>
                              </td>
                              <td valign="top" style="padding: 0 0 0 12px;">
                                <p style="margin: -2px 0 0 0; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 14px; font-weight: bold; color: #a0a0ab;">Delivered</p>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <!-- 12. STATUS BADGES -->
                <p style="margin: 0 0 12px 0; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 14px; font-weight: 700; color: #2a2a35;">/\\__STATUS__/\\</p>
                <p style="margin: 0 0 24px 0;">
                  <span style="display: inline-block; padding: 4px 12px; border-radius: 6px; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; background-color: #e6f4ea; color: #1e8e3e; border: 1px solid #cce8d6;">COMPLETED</span>
                  
                  <span style="display: inline-block; padding: 4px 12px; border-radius: 6px; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; background-color: #fff8e6; color: #b38600; border: 1px solid #fce8b2; margin-left: 8px;">PENDING</span>
                  
                  <span style="display: inline-block; padding: 4px 12px; border-radius: 6px; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; background-color: #fff0f0; color: #cc3333; border: 1px solid #fad2d2; margin-left: 8px;">FAILED</span>
                </p>

                <!-- 13. PRIMARY CTA BUTTON (NAVY) -->
                <table style="margin: 10px 0 16px 0;" role="presentation" border="0" cellspacing="0" cellpadding="0">
                  <tbody>
                    <tr>
                      <td style="background-color: #191970; border-radius: 100px; text-align: center;" bgcolor="#191970">
                        <a style="display: inline-block; font-family: 'Playfair Display', Georgia, serif; font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 100px;" href="https://example.com/primary-action">/\\__PRIMARY BUTTON__/\\</a>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <!-- 14. SECONDARY CTA BUTTON (GOLD) -->
                <table style="margin: 0 0 24px 0;" role="presentation" border="0" cellspacing="0" cellpadding="0">
                  <tbody>
                    <tr>
                      <td style="background-color: #ffbf00; border-radius: 100px; text-align: center;" bgcolor="#FFBF00">
                        <a style="display: inline-block; font-family: 'Playfair Display', Georgia, serif; font-size: 15px; font-weight: 800; color: #0a0a14; text-decoration: none; padding: 14px 40px; border-radius: 100px;" href="https://example.com/secondary-action">/\\__SECONDARY BUTTON__/\\</a>
                      </td>
                    </tr>
                  </tbody>
                </table>

              </td>
            </tr>
            <!-- ================= END BODY ================= -->

            <!-- Gold divider -->
            <tr>
              <td style="background-color: #ffbf00; height: 3px; font-size: 0; line-height: 0;" bgcolor="#FFBF00" height="3">&nbsp;</td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td style="background-color: #191970; padding: 30px 24px; text-align: center; border-radius: 0 0 20px 20px;" bgcolor="#191970">
                <table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0">
                  <tbody>
                    <tr>
                      <td style="padding-bottom: 18px;" align="center">
                        <a href="https://example.com/">
                          <img style="display: block; max-width: 110px; height: auto; margin: 0 auto;" src="https://placehold.co/220x80/191970/ffffff.png?text=Your+Brand" alt="Your Brand" width="110">
                        </a>
                      </td>
                    </tr>
                    
                    <!-- Row 1: Facebook + WhatsApp + WA Channel + Community -->
                    <tr>
                      <td style="padding-bottom: 8px;" align="center">
                        <div style="text-align: center; font-size: 0;">
                          <div style="display: inline-block; vertical-align: top; margin: 4px; font-size: 14px;">
                            <a style="text-decoration: none;" href="https://example.com/facebook">
                              <table style="background-color: #252980; border-radius: 8px;" role="presentation" border="0" cellspacing="0" cellpadding="0" bgcolor="#252980">
                                <tbody>
                                  <tr>
                                    <td style="padding: 8px 12px;">
                                      <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                                        <tbody>
                                          <tr>
                                            <td style="padding-right: 6px; line-height: 0;" valign="middle"><img style="display: block; width: 14px; height: 14px; border: 0;" src="https://cdn-icons-png.flaticon.com/16/733/733547.png" alt="Facebook" width="14" height="14"></td>
                                            <td style="font-family: 'Source Sans Pro', sans-serif; font-size: 11px; font-weight: bold; color: #ffbf00; line-height: 14px; white-space: nowrap;" valign="middle">Facebook</td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </a>
                          </div>
                          <div style="display: inline-block; vertical-align: top; margin: 4px; font-size: 14px;">
                            <a style="text-decoration: none;" href="https://example.com/support">
                              <table style="background-color: #252980; border-radius: 8px;" role="presentation" border="0" cellspacing="0" cellpadding="0" bgcolor="#252980">
                                <tbody>
                                  <tr>
                                    <td style="padding: 8px 12px;">
                                      <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                                        <tbody>
                                          <tr>
                                            <td style="padding-right: 6px; line-height: 0;" valign="middle"><img style="display: block; width: 14px; height: 14px; border: 0;" src="https://cdn-icons-png.flaticon.com/16/733/733585.png" alt="WhatsApp" width="14" height="14"></td>
                                            <td style="font-family: 'Source Sans Pro', sans-serif; font-size: 11px; font-weight: bold; color: #ffbf00; line-height: 14px; white-space: nowrap;" valign="middle">WhatsApp</td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </a>
                          </div>
                          <div style="display: inline-block; vertical-align: top; margin: 4px; font-size: 14px;">
                            <a style="text-decoration: none;" href="https://example.com/community">
                              <table style="background-color: #252980; border-radius: 8px;" role="presentation" border="0" cellspacing="0" cellpadding="0" bgcolor="#252980">
                                <tbody>
                                  <tr>
                                    <td style="padding: 8px 12px;">
                                      <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                                        <tbody>
                                          <tr>
                                            <td style="padding-right: 6px; line-height: 0;" valign="middle"><img style="display: block; width: 14px; height: 14px; border: 0;" src="https://cdn-icons-png.flaticon.com/16/733/733585.png" alt="WA Channel" width="14" height="14"></td>
                                            <td style="font-family: 'Source Sans Pro', sans-serif; font-size: 11px; font-weight: bold; color: #ffbf00; line-height: 14px; white-space: nowrap;" valign="middle">WA Channel</td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </a>
                          </div>
                          <div style="display: inline-block; vertical-align: top; margin: 4px; font-size: 14px;">
                            <a style="text-decoration: none;" href="https://example.com/community">
                              <table style="background-color: #252980; border-radius: 8px;" role="presentation" border="0" cellspacing="0" cellpadding="0" bgcolor="#252980">
                                <tbody>
                                  <tr>
                                    <td style="padding: 8px 12px;">
                                      <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                                        <tbody>
                                          <tr>
                                            <td style="padding-right: 6px; line-height: 0;" valign="middle"><img style="display: block; width: 14px; height: 14px; border: 0;" src="https://cdn-icons-png.flaticon.com/16/681/681494.png" alt="Community" width="14" height="14"></td>
                                            <td style="font-family: 'Source Sans Pro', sans-serif; font-size: 11px; font-weight: bold; color: #ffbf00; line-height: 14px; white-space: nowrap;" valign="middle">Community</td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </a>
                          </div>
                        </div>
                      </td>
                    </tr>
                    
                    <!-- Row 2: Website + Email + Phone -->
                    <tr>
                      <td style="padding-bottom: 16px;" align="center">
                        <div style="text-align: center; font-size: 0;">
                          <div style="display: inline-block; vertical-align: top; margin: 4px; font-size: 14px;">
                            <a style="text-decoration: none;" href="https://example.com/">
                              <table style="background-color: #252980; border-radius: 8px;" role="presentation" border="0" cellspacing="0" cellpadding="0" bgcolor="#252980">
                                <tbody>
                                  <tr>
                                    <td style="padding: 8px 12px;">
                                      <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                                        <tbody>
                                          <tr>
                                            <td style="padding-right: 6px; line-height: 0;" valign="middle"><img style="display: block; width: 14px; height: 14px; border: 0;" src="https://cdn-icons-png.flaticon.com/16/1006/1006771.png" alt="Website" width="14" height="14"></td>
                                            <td style="font-family: 'Source Sans Pro', sans-serif; font-size: 11px; font-weight: bold; color: #ffbf00; line-height: 14px; white-space: nowrap;" valign="middle">Website</td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </a>
                          </div>
                          <div style="display: inline-block; vertical-align: top; margin: 4px; font-size: 14px;">
                            <a style="text-decoration: none;" href="mailto:hello@example.com">
                              <table style="background-color: #252980; border-radius: 8px;" role="presentation" border="0" cellspacing="0" cellpadding="0" bgcolor="#252980">
                                <tbody>
                                  <tr>
                                    <td style="padding: 8px 12px;">
                                      <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                                        <tbody>
                                          <tr>
                                            <td style="padding-right: 6px; line-height: 0;" valign="middle"><img style="display: block; width: 14px; height: 14px; border: 0;" src="https://cdn-icons-png.flaticon.com/16/732/732200.png" alt="Email" width="14" height="14"></td>
                                            <td style="font-family: 'Source Sans Pro', sans-serif; font-size: 11px; font-weight: bold; color: #ffbf00; line-height: 14px; white-space: nowrap;" valign="middle">hello@example.com</td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </a>
                          </div>
                          <div style="display: inline-block; vertical-align: top; margin: 4px; font-size: 14px;">
                            <a style="text-decoration: none;" href="tel:+10000000000">
                              <table style="background-color: #252980; border-radius: 8px;" role="presentation" border="0" cellspacing="0" cellpadding="0" bgcolor="#252980">
                                <tbody>
                                  <tr>
                                    <td style="padding: 8px 12px;">
                                      <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                                        <tbody>
                                          <tr>
                                            <td style="padding-right: 6px; line-height: 0;" valign="middle"><img style="display: block; width: 14px; height: 14px; border: 0;" src="https://cdn-icons-png.flaticon.com/16/597/597177.png" alt="Phone" width="14" height="14"></td>
                                            <td style="font-family: 'Source Sans Pro', sans-serif; font-size: 11px; font-weight: bold; color: #ffbf00; line-height: 14px; white-space: nowrap;" valign="middle">Your support phone</td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </a>
                          </div>
                        </div>
                      </td>
                    </tr>
                    
                    <tr>
                      <td style="padding-bottom: 16px; font-family: 'Source Sans Pro', sans-serif; font-size: 10px; color: #999aaa; line-height: 1.5;" align="center">
                        Add your organization's accurate legal, regulatory, and contact disclosures here before sending this template.
                      </td>
                    </tr>
                    <tr>
                      <td style="font-family: 'Source Sans Pro', sans-serif; font-size: 11px; color: #999aaa;" align="center">&copy; 2026 Your Company. All rights reserved.</td>
                    </tr>
                    <!-- 15. WEBSITE CALL TO ACTION -->
                    <tr>
                      <td align="center" style="padding-top: 24px;">
                        <p style="margin: 0 0 16px 0; font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 14px; font-weight: bold; color: #ffffff;">Visit Your Website</p>
                        <a href="https://example.com/" style="display: inline-block; margin: 0 4px; text-decoration: none; color: #ffffff;">https://example.com</a>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
            <!-- ================= END FOOTER ================= -->
            
          </tbody>
        </table>
      </td>
    </tr>
  </tbody>
</table>

</body>
</html>`;

export const OFFICIAL_TEMPLATES: TemplateItem[] = [
  {
    id: "signalpost-master",
    name: "Your Brand | Master Email Template",
    category: "OFFICIAL_MASTER",
    badge: "Official Master",
    badgeColor: "bg-[#191970]/10 text-[#191970] border-[#191970]/20 font-bold",
    subject: "Your Brand | Master Email Template",
    description: "Reusable master email template with 15 customizable content blocks, responsive layouts, calls to action, and a branded footer.",
    html: SIGNALPOST_MASTER_HTML,
  },
];
