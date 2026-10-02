export type Theme = "sand" | "night";
export function themeKey(isAdmin: boolean) { return `manzil:theme:${isAdmin ? "admin" : "user"}`; }
export function readTheme(isAdmin: boolean, storage?: Pick<Storage, "getItem">): Theme {
  try {
    const value = storage?.getItem(themeKey(isAdmin));
    if (value === "sand" || value === "night") return value;
  } catch { /* Private browsing and blocked storage must not break navigation. */ }
  return isAdmin ? "night" : "sand";
}
export const themeInitScript = `(function(){var a=location.pathname==='/admin'||location.pathname.indexOf('/admin/')===0,t=a?'night':'sand';try{var v=localStorage.getItem('manzil:theme:'+(a?'admin':'user'));if(v==='sand'||v==='night')t=v}catch(e){}document.documentElement.dataset.theme=t})()`;
