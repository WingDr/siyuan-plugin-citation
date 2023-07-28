// 只能容纳key和value一对一存在的池子
export class LiteraturePool {
  private key2idDict: {[key: string]: string};
  private id2keyDict: {[id: string]: string};

  constructor() {
    this.id2keyDict = {};
    this.key2idDict = {};
  }

  public set(pair: {id: string, key: string}) {
    const id  = pair.id;
    const key = pair.key;
    if (this.id2keyDict[id]) {
      this.id2keyDict[id] = key;
      this.key2idDict = this.reverse(this.id2keyDict);
    } else if (this.key2idDict[key]) {
      this.key2idDict[key] = id;
      this.id2keyDict = this.reverse(this.key2idDict);
    } else {
      // 都没有就直接新建，不需要再重构目前的
      this.id2keyDict[id] = key;
      this.key2idDict[key] = id;
    }
  }

  public get(key: string) {
    return this.key2idDict[key] || this.id2keyDict[key];
  }

  public get size() {
    return Object.keys(this.id2keyDict).length;
  }

  public get keys() {
    return Object.keys(this.key2idDict);
  }

  public get ids() {
    return Object.keys(this.id2keyDict);
  }

  public get content() {
    return Object.keys(this.id2keyDict).map(id => {
      return {
        id,
        key: this.id2keyDict[id]
      };
    });
  }

  public delete(key: string) {
    if (this.id2keyDict[key]) {
      delete this.id2keyDict[key];
      this.key2idDict = this.reverse(this.id2keyDict);
      return true;
    } else if (this.key2idDict[key]) {
      delete this.key2idDict[key];
      this.id2keyDict = this.reverse(this.key2idDict);
      return true;
    } else {
      return false;
    }
  }

  private reverse(dict: {[key: string]: string}) {
    return Object.keys(dict).reduce(
      (acc, cur) => ({
          ...acc,
          [dict[cur]]: cur,
      }),
      {}
    );
  }
}