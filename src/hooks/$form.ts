// function Signup() {
//   const { fields, submit, isDirty } = $form({ email: "", password: "" });

//   return (
//     <form onsubmit={submit((data) => log.info("Saving", data))}>
//       {/* 'bindValue' is an internal Dolla directive that tracks the signal */}
//       <input type="email" bindValue={fields.email} />
//       <button disabled={() => !isDirty.track()}>Submit</button>
//     </form>
//   );
// }
