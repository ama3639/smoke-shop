"""Bounded CSV/XLSX input; spreadsheet expressions are never evaluated."""
import csv
import io
import posixpath
import zipfile
import zlib
from xml.etree import ElementTree as ET
from .services import ShopError

LIMIT = 1000000
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def invalid():
    return ShopError('INVALID_IMPORT', 'فایل باید CSV یا XLSX بدون فرمول، با ستون‌های قالب و حداکثر ۵۰۰ ردیف باشد.')


def read_table(raw, filename, columns):
    if not raw or len(raw) > LIMIT:
        raise invalid()
    try:
        if filename.lower().endswith('.csv'):
            table = list(csv.reader(io.StringIO(raw.decode('utf-8-sig')), strict=True))
        elif filename.lower().endswith('.xlsx'):
            with zipfile.ZipFile(io.BytesIO(raw)) as archive:
                infos = archive.infolist()
                if len(infos) > 100 or sum(i.file_size for i in infos) > 10000000 or any(i.flag_bits & 1 for i in infos):
                    raise invalid()
                if len({i.filename for i in infos}) != len(infos):
                    raise invalid()
                if any('externalLinks/' in i.filename or 'vbaProject' in i.filename for i in infos):
                    raise invalid()

                def xml(name):
                    data = archive.read(name)
                    if b'<!DOCTYPE' in data.upper() or b'<!ENTITY' in data.upper():
                        raise invalid()
                    return ET.fromstring(data)

                strings = []
                if 'xl/sharedStrings.xml' in archive.namelist():
                    strings = [''.join(n.itertext()) for n in xml('xl/sharedStrings.xml').findall('s:si', NS)]
                workbook = xml('xl/workbook.xml')
                sheets = workbook.findall('s:sheets/s:sheet', NS)
                if len(sheets) != 1:
                    raise invalid()
                sheet_id = sheets[0].get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
                relations = xml('xl/_rels/workbook.xml.rels')
                if any(n.get('TargetMode') == 'External' for n in relations):
                    raise invalid()
                relation = next(n for n in relations if n.get('Id') == sheet_id)
                target = relation.get('Target', '')
                sheet_path = target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/' + target)
                if not sheet_path.startswith('xl/worksheets/'):
                    raise invalid()
                sheet = xml(sheet_path)
                if sheet.findall('.//s:f', NS):
                    raise invalid()
                table = []
                for row in sheet.findall('s:sheetData/s:row', NS):
                    values = [''] * len(columns)
                    occupied = set()
                    for cell in row.findall('s:c', NS):
                        ref = cell.get('r', '')
                        letters = ''.join(c for c in ref if c.isalpha())
                        index = 0
                        for letter in letters:
                            if not 'A' <= letter <= 'Z':
                                raise invalid()
                            index = index * 26 + ord(letter) - 64
                        if not 1 <= index <= len(columns) or index in occupied:
                            raise invalid()
                        occupied.add(index)
                        value = cell.findtext('s:v', default='', namespaces=NS)
                        if cell.get('t') == 's':
                            reference = int(value)
                            if reference < 0:
                                raise invalid()
                            value = strings[reference]
                        elif cell.get('t') == 'inlineStr':
                            value = ''.join(cell.find('s:is', NS).itertext())
                        elif cell.get('t') not in (None, 'n', 'str'):
                            raise invalid()
                        values[index - 1] = value
                    table.append(values)
        else:
            raise invalid()
        if not table or table[0] != columns or not 2 <= len(table) <= 501:
            raise invalid()
        if any(len(row) != len(columns) or any(len(v) > 1000 for v in row) for row in table):
            raise invalid()
        return [dict(zip(columns, row)) for row in table[1:]]
    except (ValueError, KeyError, IndexError, StopIteration, AttributeError, ET.ParseError,
            zipfile.BadZipFile, RuntimeError, NotImplementedError, csv.Error, zlib.error, EOFError):
        raise invalid()
