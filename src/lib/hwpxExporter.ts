import JSZip from 'jszip';
import { ProductionLogMaterial } from './types';
import { formatNum } from './calculator';

interface ExportData {
  logDate: string;
  productName: string;
  productUnit: string;
  quantity: number | string;
  materials: ProductionLogMaterial[];
  notes?: string;
}

/**
 * HWPX (한글과컴퓨터 표준 개방형 문서) 파일 생성 및 브라우저 다운로드
 */
export async function downloadHWPX(data: ExportData) {
  const zip = new JSZip();

  // 1. mimetype (KS X 6101 규격: 압축 없이 맨 앞에 위치)
  zip.file('mimetype', 'application/hwp+zip', { compression: 'STORE' });

  // 2. version.xml
  const versionXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<hh:version xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" major="1" minor="0" micro="0" buildNumber="1" os="1" xmlVersion="1.0" application="Hancom Office"/>`;
  zip.file('version.xml', versionXml);

  // 3. META-INF/manifest.xml
  const manifestXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<od:manifest xmlns:od="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
  <od:file-entry od:media-type="application/hwp+zip" od:full-path="/"/>
  <od:file-entry od:media-type="application/xml" od:full-path="Contents/content.hpf"/>
  <od:file-entry od:media-type="application/xml" od:full-path="Contents/header.xml"/>
  <od:file-entry od:media-type="application/xml" od:full-path="Contents/section0.xml"/>
  <od:file-entry od:media-type="application/xml" od:full-path="settings.xml"/>
</od:manifest>`;
  zip.folder('META-INF')?.file('manifest.xml', manifestXml);

  // 4. settings.xml
  const settingsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<ha:settings xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app"/>`;
  zip.file('settings.xml', settingsXml);

  // 5. Contents/content.hpf
  const contentHpf = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<package xmlns="http://www.hancom.co.kr/hwpml/2011/head" unique-identifier="damwoo-log">
  <metadata>
    <title>생산일지_원료수불부</title>
    <language>ko</language>
  </metadata>
  <manifest>
    <item id="header" href="header.xml" media-type="application/xml"/>
    <item id="section0" href="section0.xml" media-type="application/xml"/>
  </manifest>
  <spine>
    <itemref idref="section0"/>
  </spine>
</package>`;

  // 6. Contents/header.xml
  const headerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core">
  <hh:fontfaces>
    <hh:fontface lang="ko" fontCnt="1">
      <hh:font id="0" face="맑은 고딕" type="ttf"/>
    </hh:fontface>
  </hh:fontfaces>
  <hh:borderFills>
    <hh:borderFill id="1">
      <hh:slash type="none"/>
      <hh:backSlash type="none"/>
      <hh:leftBorder type="solid" width="0.12 mm" color="#000000"/>
      <hh:rightBorder type="solid" width="0.12 mm" color="#000000"/>
      <hh:topBorder type="solid" width="0.12 mm" color="#000000"/>
      <hh:bottomBorder type="solid" width="0.12 mm" color="#000000"/>
    </hh:borderFill>
  </hh:borderFills>
  <hh:charProperties>
    <hh:charPr id="0" height="1000" textColor="#000000" fontId="0"/>
    <hh:charPr id="1" height="1800" textColor="#000000" fontId="0" bold="1"/>
    <hh:charPr id="2" height="1100" textColor="#000000" fontId="0" bold="1"/>
    <hh:charPr id="3" height="900" textColor="#000000" fontId="0"/>
  </hh:charProperties>
  <hh:paraProperties>
    <hh:paraPr id="0" align="center"/>
    <hh:paraPr id="1" align="left"/>
    <hh:paraPr id="2" align="right"/>
  </hh:paraProperties>
</hh:head>`;

  // 날짜 문자열 처리
  const dateFormatted = data.logDate
    ? data.logDate.replace(/(\d{4})-(\d{2})-(\d{2})/, '$1년  $2월  $3일')
    : '년   월   일';

  // 7. Contents/section0.xml (XML 데이터)
  // 완제품 8행
  let prodRowsXml = '';
  for (let i = 0; i < 8; i++) {
    const isFirst = i === 0;
    const name = isFirst ? escapeXml(data.productName) : '';
    const unit = isFirst ? escapeXml(data.productUnit) : '';
    const qty = isFirst ? escapeXml(formatNum(data.quantity)) : '';

    prodRowsXml += `
      <hp:tr>
        <hp:tc><hp:cellAddr colAddr="0" rowAddr="${i+1}"/><hp:p><hp:run><hp:t>${name}</hp:t></hp:run></hp:p></hp:tc>
        <hp:tc><hp:cellAddr colAddr="1" rowAddr="${i+1}"/><hp:p><hp:run><hp:t>${unit}</hp:t></hp:run></hp:p></hp:tc>
        <hp:tc><hp:cellAddr colAddr="2" rowAddr="${i+1}"/><hp:p><hp:run><hp:t>${qty}</hp:t></hp:run></hp:p></hp:tc>
        <hp:tc><hp:cellAddr colAddr="3" rowAddr="${i+1}"/><hp:p><hp:run><hp:t></hp:t></hp:run></hp:p></hp:tc>
        <hp:tc><hp:cellAddr colAddr="4" rowAddr="${i+1}"/><hp:p><hp:run><hp:t></hp:t></hp:run></hp:p></hp:tc>
        <hp:tc><hp:cellAddr colAddr="5" rowAddr="${i+1}"/><hp:p><hp:run><hp:t></hp:t></hp:run></hp:p></hp:tc>
      </hp:tr>`;
  }

  // 원료수불부 20행
  let matRowsXml = '';
  for (let i = 0; i < 20; i++) {
    const mat = data.materials[i];
    const name = mat ? escapeXml(mat.ingredient_name) : '';
    const unit = mat ? escapeXml(mat.unit) : '';
    const inQty = mat ? escapeXml(formatNum(mat.in_quantity)) : '';
    const outQty = mat ? escapeXml(formatNum(mat.out_quantity)) : '';
    const rem = mat ? escapeXml(mat.remarks) : '';

    matRowsXml += `
      <hp:tr>
        <hp:tc><hp:cellAddr colAddr="0" rowAddr="${i+1}"/><hp:p><hp:run><hp:t>${name}</hp:t></hp:run></hp:p></hp:tc>
        <hp:tc><hp:cellAddr colAddr="1" rowAddr="${i+1}"/><hp:p><hp:run><hp:t>${unit}</hp:t></hp:run></hp:p></hp:tc>
        <hp:tc><hp:cellAddr colAddr="2" rowAddr="${i+1}"/><hp:p><hp:run><hp:t>${inQty}</hp:t></hp:run></hp:p></hp:tc>
        <hp:tc><hp:cellAddr colAddr="3" rowAddr="${i+1}"/><hp:p><hp:run><hp:t>${outQty}</hp:t></hp:run></hp:p></hp:tc>
        <hp:tc><hp:cellAddr colAddr="4" rowAddr="${i+1}"/><hp:p><hp:run><hp:t>${rem}</hp:t></hp:run></hp:p></hp:tc>
      </hp:tr>`;
  }

  const section0Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<hp:sec xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">
  <hp:p paraPrIDRef="0">
    <hp:run charPrIDRef="1"><hp:t>생산일지 / 원료수불부</hp:t></hp:run>
  </hp:p>
  <hp:p paraPrIDRef="1">
    <hp:run charPrIDRef="2"><hp:t>작성일 : ${escapeXml(dateFormatted)}</hp:t></hp:run>
  </hp:p>
  <hp:p paraPrIDRef="1">
    <hp:run charPrIDRef="2"><hp:t>1. 생산일보</hp:t></hp:run>
  </hp:p>
  <hp:tbl rowCnt="9" colCnt="6">
    <hp:tr>
      <hp:tc><hp:cellAddr colAddr="0" rowAddr="0"/><hp:p><hp:run><hp:t>제 품 명</hp:t></hp:run></hp:p></hp:tc>
      <hp:tc><hp:cellAddr colAddr="1" rowAddr="0"/><hp:p><hp:run><hp:t>단 위</hp:t></hp:run></hp:p></hp:tc>
      <hp:tc><hp:cellAddr colAddr="2" rowAddr="0"/><hp:p><hp:run><hp:t>생 산 량</hp:t></hp:run></hp:p></hp:tc>
      <hp:tc><hp:cellAddr colAddr="3" rowAddr="0"/><hp:p><hp:run><hp:t>제 품 명</hp:t></hp:run></hp:p></hp:tc>
      <hp:tc><hp:cellAddr colAddr="4" rowAddr="0"/><hp:p><hp:run><hp:t>단 위</hp:t></hp:run></hp:p></hp:tc>
      <hp:tc><hp:cellAddr colAddr="5" rowAddr="0"/><hp:p><hp:run><hp:t>생 산 량</hp:t></hp:run></hp:p></hp:tc>
    </hp:tr>
    ${prodRowsXml}
  </hp:tbl>
  <hp:p paraPrIDRef="1">
    <hp:run charPrIDRef="2"><hp:t>2. 원료수불부</hp:t></hp:run>
  </hp:p>
  <hp:tbl rowCnt="21" colCnt="5">
    <hp:tr>
      <hp:tc><hp:cellAddr colAddr="0" rowAddr="0"/><hp:p><hp:run><hp:t>품 명</hp:t></hp:run></hp:p></hp:tc>
      <hp:tc><hp:cellAddr colAddr="1" rowAddr="0"/><hp:p><hp:run><hp:t>단 위</hp:t></hp:run></hp:p></hp:tc>
      <hp:tc><hp:cellAddr colAddr="2" rowAddr="0"/><hp:p><hp:run><hp:t>입 고 량</hp:t></hp:run></hp:p></hp:tc>
      <hp:tc><hp:cellAddr colAddr="3" rowAddr="0"/><hp:p><hp:run><hp:t>사 용 량</hp:t></hp:run></hp:p></hp:tc>
      <hp:tc><hp:cellAddr colAddr="4" rowAddr="0"/><hp:p><hp:run><hp:t>비 고</hp:t></hp:run></hp:p></hp:tc>
    </hp:tr>
    ${matRowsXml}
  </hp:tbl>
  <hp:p paraPrIDRef="1">
    <hp:run charPrIDRef="2"><hp:t>□ 특이사항</hp:t></hp:run>
  </hp:p>
  <hp:p paraPrIDRef="1">
    <hp:run charPrIDRef="3"><hp:t>${escapeXml(data.notes || '없음')}</hp:t></hp:run>
  </hp:p>
</hp:sec>`;

  const contents = zip.folder('Contents');
  contents?.file('content.hpf', contentHpf);
  contents?.file('header.xml', headerXml);
  contents?.file('section0.xml', section0Xml);

  // 파일 압축 생성
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/hwp+zip',
  });

  // 다운로드 트리거
  const filename = `생산일지_${data.logDate || '무제'}_${data.productName || '제품'}.hwpx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeXml(str: string | undefined | null): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
