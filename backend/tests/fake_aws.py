"""テスト用のインメモリ DynamoDB スタブ。boto3 の代わりに sys.modules へ差し込む。

db.py が実際に使っている機能だけを実装する:
  put_item(ConditionExpression="attribute_not_exists(...)")
  get_item / query(KeyConditionExpression: eq / begins_with / gt, IndexName, ScanIndexForward)
  update_item(SET / ADD / REMOVE / if_not_exists / #name / :value, ReturnValues)
  batch_writer(put_item / delete_item)
"""

import re
import sys
import types


# ---------------- 条件式 (boto3.dynamodb.conditions 相当) ----------------

class _Cond:
    def __init__(self, fn):
        self.fn = fn

    def __and__(self, other):
        return _Cond(lambda item: self.fn(item) and other.fn(item))

    def test(self, item):
        return self.fn(item)


class Key:
    def __init__(self, name):
        self.name = name

    def eq(self, value):
        return _Cond(lambda i, n=self.name, v=value: i.get(n) == v)

    def begins_with(self, prefix):
        return _Cond(
            lambda i, n=self.name, p=prefix: isinstance(i.get(n), str) and i[n].startswith(p)
        )

    def gt(self, value):
        return _Cond(
            lambda i, n=self.name, v=value: isinstance(i.get(n), str) and i[n] > v
        )


Attr = Key


# ---------------- 例外 ----------------

class ConditionalCheckFailedException(Exception):
    pass


class _Exceptions:
    ConditionalCheckFailedException = ConditionalCheckFailedException


class _Client:
    exceptions = _Exceptions()


class _Meta:
    client = _Client()


# ---------------- UpdateExpression の適用 ----------------

def _split_top_level(text):
    """括弧の深さを見ながらカンマで分割する（if_not_exists(a, :b) を壊さない）。"""
    parts, depth, buf = [], 0, ""
    for ch in text:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            parts.append(buf.strip())
            buf = ""
        else:
            buf += ch
    if buf.strip():
        parts.append(buf.strip())
    return parts


def _resolve_name(token, names):
    token = token.strip()
    return names.get(token, token)


def _resolve_value(token, item, names, values):
    token = token.strip()
    inner = re.match(r"if_not_exists\((.+?),\s*(:[\w]+)\)$", token)
    if inner:
        attr = _resolve_name(inner.group(1), names)
        if attr in item:
            return item[attr]
        return values[inner.group(2)]
    if token.startswith(":"):
        return values[token]
    return _resolve_name(token, names)


def _apply_update(item, expression, names, values):
    expression = expression.strip()
    updated = {}

    add_match = re.search(r"\bADD\b", expression)
    if add_match:
        set_text = expression[:add_match.start()].strip()
        add_text = expression[add_match.end():].strip()
    else:
        set_text, add_text = expression, ""

    # REMOVE 句があれば先に処理して、残りを SET として扱う
    remove_match = re.search(r"\bREMOVE\b", set_text)
    if remove_match:
        before = set_text[:remove_match.start()].strip()
        rest = set_text[remove_match.end():].strip()

        set_again = re.search(r"\bSET\b", rest)
        if set_again:
            remove_text = rest[:set_again.start()].strip()
            rest_set = "SET " + rest[set_again.end():].strip()
        else:
            remove_text, rest_set = rest, ""

        for attr_token in _split_top_level(remove_text):
            if attr_token:
                item.pop(_resolve_name(attr_token, names), None)

        set_text = (before + " " + rest_set).strip() if before else rest_set

    if set_text.upper().startswith("SET"):
        for assign in _split_top_level(set_text[3:]):
            left, right = assign.split("=", 1)
            attr = _resolve_name(left, names)
            item[attr] = _resolve_value(right, item, names, values)
            updated[attr] = item[attr]

    for clause in _split_top_level(add_text):
        if not clause:
            continue
        attr_token, value_token = clause.split()
        attr = _resolve_name(attr_token, names)
        item[attr] = (item.get(attr) or 0) + values[value_token.strip()]
        updated[attr] = item[attr]

    return updated


# ---------------- テーブル ----------------

class FakeTable:
    def __init__(self, name):
        self.name = name
        self.items = {}
        self.meta = _Meta()

    def _key(self, item):
        return (item["PK"], item["SK"])

    def put_item(self, Item, ConditionExpression=None):
        key = self._key(Item)
        if ConditionExpression:
            missing = re.match(r"attribute_not_exists\((\w+)\)", ConditionExpression.strip())
            if missing and key in self.items:
                raise ConditionalCheckFailedException(ConditionExpression)
        self.items[key] = dict(Item)
        return {}

    def get_item(self, Key):
        found = self.items.get((Key["PK"], Key["SK"]))
        return {"Item": dict(found)} if found else {}

    def delete_item(self, Key):
        self.items.pop((Key["PK"], Key["SK"]), None)
        return {}

    def query(self, KeyConditionExpression=None, IndexName=None,
              ScanIndexForward=True, ExclusiveStartKey=None, **_):
        rows = [i for i in self.items.values() if KeyConditionExpression.test(i)]
        sort_attr = f"{IndexName}SK" if IndexName else "SK"
        rows.sort(key=lambda i: str(i.get(sort_attr) or ""), reverse=not ScanIndexForward)
        return {"Items": [dict(r) for r in rows]}

    def update_item(self, Key, UpdateExpression, ExpressionAttributeValues=None,
                    ExpressionAttributeNames=None, ReturnValues=None, **_):
        key = (Key["PK"], Key["SK"])
        item = self.items.setdefault(key, {"PK": Key["PK"], "SK": Key["SK"]})
        updated = _apply_update(
            item, UpdateExpression,
            ExpressionAttributeNames or {}, ExpressionAttributeValues or {},
        )
        return {"Attributes": updated} if ReturnValues else {}

    def batch_writer(self):
        table = self

        class _Batch:
            def __enter__(self):
                return self

            def __exit__(self, *exc):
                return False

            def put_item(self, Item):
                table.put_item(Item=Item)

            def delete_item(self, Key):
                table.delete_item(Key=Key)

        return _Batch()


class FakeS3Client:
    """署名付き URL の発行だけを模擬する。"""

    def __init__(self):
        self.puts = []

    def generate_presigned_url(self, operation, Params=None, ExpiresIn=None):
        params = Params or {}
        key = params.get("Key", "")
        self.puts.append((operation, key))
        return f"https://example.test/{key}?op={operation}&exp={ExpiresIn}"


class _Resource:
    def __init__(self):
        self.tables = {}
        self.s3 = FakeS3Client()

    def Table(self, name):
        return self.tables.setdefault(name, FakeS3Client) if False else             self.tables.setdefault(name, FakeTable(name))


_RESOURCE = _Resource()


def install():
    """boto3 と boto3.dynamodb.conditions を偽物に差し替える。"""
    boto3 = types.ModuleType("boto3")
    boto3.resource = lambda service, **kw: _RESOURCE
    boto3.client = lambda service, **kw: _RESOURCE.s3

    # uploads.py が botocore.config.Config を読み込むので用意しておく
    botocore = types.ModuleType("botocore")
    botocore_config = types.ModuleType("botocore.config")

    class Config:
        def __init__(self, **kw):
            self.kw = kw

    botocore_config.Config = Config
    botocore.config = botocore_config
    sys.modules["botocore"] = botocore
    sys.modules["botocore.config"] = botocore_config

    dynamodb_mod = types.ModuleType("boto3.dynamodb")
    conditions = types.ModuleType("boto3.dynamodb.conditions")
    conditions.Key = Key
    conditions.Attr = Attr
    dynamodb_mod.conditions = conditions
    boto3.dynamodb = dynamodb_mod

    sys.modules["boto3"] = boto3
    sys.modules["boto3.dynamodb"] = dynamodb_mod
    sys.modules["boto3.dynamodb.conditions"] = conditions
    return _RESOURCE


def reset():
    _RESOURCE.tables.clear()
