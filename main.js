// ==UserScript==
// @name         百度云直链批量转存
// @namespace    http://sub.ntt.ink/百度云直链批量转存.user.js
// @version      0.3.4
// @description  百度云直链批量转存
// @author       deycoesr@gmail.com
// @match        *://pan.baidu.com/disk/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=pan.baidu.com
// @grant        unsafeWindow
// ==/UserScript==

(function () {
  const BUTTON_EXIST_ID = "button-g0u198g2ukasd9761yhjkjbsd617872gv78asd",
    // 最后一次操作信息存储 KEY
    LAST_OPT_INFO_LOCAL_STOREAGE_KEY =
      "lastOpt:1i0v91h2daosf91oudhf981s8gpu18287he";

  setInterval(() => {
    if (!document.getElementById(BUTTON_EXIST_ID)) {
      let buttonGroup = document.querySelector(
        ".wp-s-core-pan__header-tool-bar--action > .wp-s-agile-tool-bar > .wp-s-agile-tool-bar__header > .wp-s-agile-tool-bar__h-group > .u-button-group"
      );
      if (!buttonGroup) {
        // 兼容旧版
        buttonGroup = document.querySelector(".tcuLAu");
      }
      if (buttonGroup) {
        appendBtn(buttonGroup);
      }
    }
  }, 200);

  function appendBtn(buttonGroup) {
    let batchSaveBtn = document.createElement("button");
    batchSaveBtn.btnType = 0;
    batchSaveBtn.id = BUTTON_EXIST_ID;
    batchSaveBtn.originalInnerText = "批量保存";
    batchSaveBtn.innerText = batchSaveBtn.originalInnerText;
    batchSaveBtn.onclick = (e) => batchSave.call(batchSaveBtn, e);
    batchSaveBtn.style = `background-color: #f0faff; border-bottom-left-radius: 16px; \
       border-top-left-radius: 16px; margin-left: 5px; padding-left: \
       16px; padding-right: 8px; border: 0; \
       margin-right: -1px; height: 32px;`;

    buttonGroup.append(batchSaveBtn);

    let batchUploadBtn = document.createElement("button");
    batchUploadBtn.btnType = 1;
    batchUploadBtn.originalInnerText = "选择文件夹";
    batchUploadBtn.innerText = batchUploadBtn.originalInnerText;
    batchUploadBtn.onclick = function () {
      let batchUploadInput = document.createElement("input");
      batchUploadInput.type = "file";
      batchUploadInput.webkitdirectory = true;
      batchUploadInput.multiple = true;
      batchUploadInput.onchange = (e) => parseFolder.call(batchUploadBtn, e);
      batchUploadInput.click();
    };
    batchUploadBtn.style = `background-color: #f0faff; border-bottom-right-radius: 16px; \
      border-top-right-radius: 16px; padding-right: 16px; \
      padding-left: 8px; margin-right: 5px; \
      border: 0; height: 32px`;

    buttonGroup.append(createDividerElement());
    buttonGroup.append(batchUploadBtn);

    let lastOptInfo = localStorage[LAST_OPT_INFO_LOCAL_STOREAGE_KEY];
    if (typeof lastOptInfo === "string") {
      lastOptInfo = JSON.parse(lastOptInfo);
      if (lastOptInfo.errorMsg) {
        window.alert(lastOptInfo.errorMsg);
      }
      const btnTypeAry = [batchSaveBtn, batchUploadBtn];

      let showLastOptInfoIntervalId,
        remainSeconds = 6;
      let showLastOptInfoFun = () => {
        remainSeconds--;
        let targetBtn = btnTypeAry[lastOptInfo.btnType];
        targetBtn.innerText =
          "上次共保存 " + lastOptInfo.total + " 个链接 (" + remainSeconds + ")";
        if (remainSeconds < 1) {
          targetBtn.innerText = targetBtn.originalInnerText;
          localStorage.removeItem(LAST_OPT_INFO_LOCAL_STOREAGE_KEY);
          clearInterval(showLastOptInfoIntervalId);
        }
      };
      showLastOptInfoFun.call();
      showLastOptInfoIntervalId = setInterval(showLastOptInfoFun, 1000);
    }
  }

  function createDividerElement() {
    let elem = document.createElement("span");
    elem.style = "border-left: 1px solid black; height: 11px; margin-top: 11px";
    return elem;
  }

  const PATH_SPLIT_REGEX = /[/\\]/,
    URLS_SPLIT_REGEX = /\s/;

  async function parseFolder(e) {
    let files = e?.target?.files;
    if (files) {
      let texts = [];
      for (const file of files) {
        if (file.type === "text/plain") {
          texts.push(await file.text());
        }
      }
      let urls = texts.reduce((left, right) => left + "\n" + right, "");

      await doBatchSave.call(this, urls);
    } else {
      window.alert("未能获得到文件");
    }
  }

  async function batchSave() {
    let urlsText = prompt("以 '空格' 或 '换行' 作为间隔符\n输入分享链接:");
    if (!urlsText) {
      return;
    }

    await doBatchSave.call(this, urlsText);
  }

  /**
   * 处理 url空格提取码 的情况
   */
  function populateUrls(urls) {
    for (let index = 0; index < urls.length; index++) {
      let url = urls[index];
      if (url.startsWith("http") && url.indexOf("?pwd=") < 0) {
        // 如果是链接并且没有提取码
        // 那么默认提取码是下一个
        let pwd = urls[index + 1];
        if (pwd.startsWith("http")) {
          const errorMsg = "链接 '" + url + "' 无法找到对应的提取码";
          window.alert(errorMsg);
          throw new Error(errorMsg);
        }
        urls[index] = url + "?pwd=" + pwd;
        urls.splice(index + 1, 1);
      }
    }

    for (let url of urls) {
      if (!url.startsWith("http")) {
        const errorMsg = "无效的链接 '" + url + "'";
        window.alert(errorMsg);
        throw new Error(errorMsg);
      }
    }

    // 去掉重复
    return [...new Set(urls)];
  }

  async function doBatchSave(urlsText) {
    let urls = urlsText
      .split(URLS_SPLIT_REGEX)
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    urls = populateUrls(urls);

    if (urls.length === 0) {
      window.alert("未能获得有效的链接");
      return;
    }

    this.innerText = "共获得 " + urls.length + " 个有效链接";
    console.log("batch-save; 有效的 urls = " + urls);

    const now = new Date();

    let targetFolders = prompt(
      "以 '/' 或 '\\' 作为分隔符\n无效路径默认为根目录\n输入存储路径:",
      `${now.getFullYear()}年/${now.getMonth() + 1}月/${now.getDate()}号`
    );
    if (targetFolders) {
      targetFolders = targetFolders
        .split(PATH_SPLIT_REGEX)
        .map((url) => url.trim())
        .filter((path) => path.length > 0);
    } else {
      targetFolders = [];
    }

    const targetWin = unsafeWindow.open(
      "about:blank",
      "taget",
      "width=1080,height=720"
    );

    let errorMap = new Map();

    let savedTotal = 0;

    for (let urlIndex = 0; urlIndex < urls.length; urlIndex++) {
      let url = urls[urlIndex];
      this.innerText =
        "正在处理第 " + (urlIndex + 1) + " 个链接，共 " + urls.length + " 个";
      targetWin.location.href = url;

      await waitFound(() => {
        let submitBtn = targetWin.document.getElementById("submitBtn");
        let tipsElement = document.getElementById("bctcKzym");
        if (submitBtn && submitBtn.innerText === "提取文件" && !tipsElement) {
          submitBtn.click();
        }

        return targetWin.location.href.startsWith(url);
      });

      const targetDoc = targetWin.document;

      await waitFound(() => targetDoc.readyState === "complete");

      let errorReasonElem = targetDoc.querySelector("div.error-reason");
      if (errorReasonElem) {
        errorMap.set(url, errorReasonElem.textContent);
        continue;
      }

      let saveBtnPatten;
      if (targetWin.location.href.indexOf("path=") > 0) {
        // 分享的文件夹 需要点击选择全部

        // 点击选择全部
        const selectAllCheckbox = await waitFound(() =>
          targetDoc.querySelector("li[data-key='server_filename'] > div")
        );
        selectAllCheckbox.click();

        saveBtnPatten =
          "a.g-button[style='display: inline-block;'][title='保存到我的百度网盘']";
      } else {
        // 分享的单个文件 直接保存就行
        saveBtnPatten = "a.g-button.tools-share-save-hb[title='保存到网盘']";
      }

      const saveBtn = await waitFound(() =>
        targetDoc.querySelector(saveBtnPatten)
      );
      saveBtn.click();

      const confirmBtn = await waitFound(() =>
        targetDoc.querySelector("a[title='确定'][node-type='confirm']")
      );

      if (targetFolders.length !== 0) {
        let foundFolderNodes = async () => {
          return await waitFound(() =>
            targetDoc.querySelectorAll(
              "div.file-tree-container > ul.treeview.treeview-content > li > ul > li"
            )
          );
        };

        let folderNodes = await foundFolderNodes();

        let newFolderBtn = targetDoc.querySelector(
          "a.g-button.g-button-large[title='新建文件夹']"
        );

        OUT: for (
          let folderDeep = 0;
          folderDeep < targetFolders.length;
          folderDeep++
        ) {
          const targetFolder = targetFolders[folderDeep],
            currPath =
              "/" +
              targetFolders
                .slice(0, folderDeep + 1)
                .reduce((left, right) => left + "/" + right);
          for (const node of folderNodes) {
            const nodePath = node
              .querySelector("span.treeview-txt")
              .getAttribute("node-path");
            if (nodePath === currPath) {
              // 找到已经存在的路径节点
              // 点击并选择
              node.querySelector("div.treeview-node").click();
              foundFolderNodes = async () => {
                return await waitFound(() => node.querySelectorAll("ul > li"));
              };

              // 如果是最后一层不需要重新查找
              if (folderDeep + 1 >= targetFolders.length) {
                break OUT;
              } else {
                folderNodes = await foundFolderNodes();
                continue OUT;
              }
            }
          }
          // 未能找到路径 需要进行创建
          newFolderBtn.click();

          const createFolderInput = targetDoc.querySelector(
            "span.plus-create-folder > input"
          );
          createFolderInput.value = targetFolder;

          (
            await waitFound(() =>
              targetDoc.querySelector(
                "span.plus-create-folder > span.sure.shareFolderConfirm"
              )
            )
          ).click();

          await waitFound(
            () =>
              !targetDoc.querySelector(
                "span.plus-create-folder > span.sure.shareFolderConfirm"
              )
          );

          // 如果是最后一层 创建之后会自动选中 所以不需要重新查找
          if (folderDeep + 1 >= targetFolders.length) {
            break;
          }

          // 新建的节点不存在子节点
          folderNodes = [];
        }
      }

      confirmBtn.click();

      await waitFound(
        () =>
          targetDoc.querySelector("div.info-section-title")?.innerText ===
          "保存成功"
      );

      savedTotal++;
    }

    let errorMsg;
    if (errorMap.size > 0) {
      errorMsg = [...errorMap.entries()]
        .map(([url, errorReason]) => "[" + url + "]的失败原因: " + errorReason)
        .reduce((prev, curr) => prev + "\n" + curr);
    }

    localStorage[LAST_OPT_INFO_LOCAL_STOREAGE_KEY] = JSON.stringify({
      btnType: this.btnType,
      total: savedTotal,
      errorMsg: errorMsg
    });

    await targetWin.close();

    unsafeWindow.location.reload();
  }

  async function waitFound(conditionFun, maxnum = 300) {
    let count = 0;
    for (; ;) {
      let param = await conditionFun.call();
      if (param && param.length !== 0) {
        return param;
      }
      await sleep(200);
      if (++count > maxnum) {
        throw new Error("超出最大等待次数");
      }
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
})();
